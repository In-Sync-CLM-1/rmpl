import { corsHeaders } from '../_shared/cors-headers.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { successResponse, errorResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

interface SyncRequest {
  trigger?: 'scheduled' | 'manual';
  triggered_by_user_id?: string;
  resume_sync_id?: string; // For resuming failed syncs
  continue_sync_id?: string; // For self-continuation (internal use)
}

const BATCH_SIZE = 1000;
const BATCHES_PER_INVOCATION = 50; // Process 50 batches per function call to avoid timeout

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Sync process initiated');
    
    const supabase = createSupabaseClient();
    const authHeader = req.headers.get('Authorization');

    const { trigger = 'scheduled', triggered_by_user_id, resume_sync_id, continue_sync_id }: SyncRequest = 
      await req.json().catch(() => ({}));

    // Handle self-continuation (no auth check needed - internal call)
    if (continue_sync_id) {
      console.log(`🔄 Continuing sync: ${continue_sync_id}`);
      
      // Verify sync exists and is still running
      const { data: existingSync, error: syncError } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('id', continue_sync_id)
        .eq('status', 'running')
        .single();

      if (syncError || !existingSync) {
        console.log('⚠️ Sync not found or not running, skipping continuation');
        return successResponse({ success: true, message: 'Sync not active, skipping' });
      }

      // Update sync log timestamp to show activity
      await supabase
        .from('sync_logs')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', continue_sync_id);

      // Process next chunk of batches
      EdgeRuntime.waitUntil(processAllBatchesWithRpc(continue_sync_id, trigger, supabase, true));

      return successResponse({
        success: true,
        syncId: continue_sync_id,
        status: 'continuing',
        message: 'Processing next chunk of batches.',
      });
    }

    // Verify authorization for manual triggers
    if (trigger === 'manual') {
      if (!authHeader) {
        return unauthorizedResponse('Missing authorization header');
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return unauthorizedResponse('Invalid authentication');
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'super_admin', 'platform_admin']);

      if (!roles || roles.length === 0) {
        return errorResponse('Insufficient permissions', 403);
      }
    }

    // If resuming an existing sync
    if (resume_sync_id) {
      console.log(`🔄 Resuming sync: ${resume_sync_id}`);
      
      // Check sync exists and is resumable
      const { data: existingSync, error: syncError } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('id', resume_sync_id)
        .single();

      if (syncError || !existingSync) {
        return errorResponse('Sync not found', 404);
      }

      if (existingSync.status === 'running') {
        return errorResponse('Sync is already running', 409);
      }

      // Update sync status to running
      await supabase
        .from('sync_logs')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', resume_sync_id);

      // Start background processing of pending/failed batches
      EdgeRuntime.waitUntil(processRemainingBatches(resume_sync_id, trigger, supabase));

      return successResponse({
        success: true,
        syncId: resume_sync_id,
        status: 'resumed',
        message: 'Sync resumed. Processing remaining batches.',
      });
    }

    // Check for running sync and auto-mark stale ones as failed (no activity for 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // First, mark stale syncs as failed (using updated_at instead of created_at)
    await supabase
      .from('sync_logs')
      .update({ status: 'failed', error_details: [{ message: 'Auto-failed due to inactivity (no update for 10 minutes)' }] })
      .eq('status', 'running')
      .lt('updated_at', tenMinutesAgo);

    // Then check for any still-running syncs
    const { data: runningSyncs } = await supabase
      .from('sync_logs')
      .select('id, created_at, updated_at')
      .eq('status', 'running')
      .limit(1);

    if (runningSyncs && runningSyncs.length > 0) {
      console.log('⚠️ Sync already running:', runningSyncs[0].id);
      return errorResponse('Sync already in progress', 409);
    }

    // Count total unique records from the deduplicated view
    const { count: totalRecords, error: countError } = await supabase
      .from('demandcom_latest_per_mobile')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count records: ${countError.message}`);
    }

    const totalBatches = Math.ceil((totalRecords || 0) / BATCH_SIZE);
    console.log(`📊 Total unique records to sync: ${totalRecords}, Total batches: ${totalBatches}`);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'demandcom_to_master',
        status: 'running',
        items_fetched: 0,
        items_inserted: 0,
        items_updated: 0,
        items_failed: 0,
        total_batches: totalBatches,
        current_batch: 0,
      })
      .select()
      .single();

    if (syncLogError) {
      throw new Error(`Failed to create sync log: ${syncLogError.message}`);
    }

    console.log(`✅ Sync log created: ${syncLog.id}`);

    // Create batch entries
    const batches = Array.from({ length: totalBatches }, (_, i) => ({
      sync_log_id: syncLog.id,
      batch_number: i + 1,
      offset_start: i * BATCH_SIZE,
      batch_size: BATCH_SIZE,
      status: 'pending'
    }));

    if (batches.length > 0) {
      const { error: batchInsertError } = await supabase
        .from('sync_batches')
        .insert(batches);

      if (batchInsertError) {
        throw new Error(`Failed to create batches: ${batchInsertError.message}`);
      }
      console.log(`✅ Created ${batches.length} batch entries`);
    }

    // Start background processing using Postgres function
    EdgeRuntime.waitUntil(processAllBatchesWithRpc(syncLog.id, trigger, supabase, false));

    // Return immediately with job info
    return successResponse({
      success: true,
      syncId: syncLog.id,
      status: 'started',
      totalRecords: totalRecords || 0,
      totalBatches,
      message: 'Sync started in background using optimized Postgres processing.',
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    return errorResponse(errorMessage, 500, { details: errorDetails });
  }
});

// Trigger self-continuation by invoking this function again
async function triggerContinuation(syncLogId: string, trigger: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for continuation');
    return;
  }

  console.log(`🔄 Triggering continuation for sync: ${syncLogId}`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-demandcom-to-master`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ 
        continue_sync_id: syncLogId,
        trigger 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Continuation trigger failed: ${errorText}`);
    } else {
      console.log('✅ Continuation triggered successfully');
    }
  } catch (error) {
    console.error('❌ Failed to trigger continuation:', error);
  }
}

// Process all batches using the Postgres function (much faster)
async function processAllBatchesWithRpc(syncLogId: string, trigger: string, supabase: any, isContinuation: boolean) {
  const startTime = Date.now();
  console.log(`🚀 Starting background processing using Postgres RPC (continuation: ${isContinuation})`);

  try {
    // Get all pending batches
    const { data: batches, error: batchError } = await supabase
      .from('sync_batches')
      .select('id, batch_number')
      .eq('sync_log_id', syncLogId)
      .eq('status', 'pending')
      .order('batch_number', { ascending: true });

    if (batchError) {
      throw new Error(`Failed to fetch batches: ${batchError.message}`);
    }

    const totalPending = batches?.length || 0;
    console.log(`📦 Found ${totalPending} pending batches via Postgres RPC`);

    if (totalPending === 0) {
      // All batches done - finalize the sync
      console.log('✅ All batches completed, finalizing sync...');
      await finalizeSyncAndNotify(syncLogId, trigger, supabase, startTime);
      return;
    }

    // Process up to BATCHES_PER_INVOCATION batches
    const batchesToProcess = batches.slice(0, BATCHES_PER_INVOCATION);
    console.log(`📦 Processing ${batchesToProcess.length} of ${totalPending} pending batches`);

    for (let i = 0; i < batchesToProcess.length; i++) {
      const batch = batchesToProcess[i];
      console.log(`📦 Processing batch ${batch.batch_number} via RPC (${i + 1}/${batchesToProcess.length})`);
      
      const { data: result, error: rpcError } = await supabase.rpc('process_sync_batch', {
        p_batch_id: batch.id
      });

      if (rpcError) {
        console.error(`❌ RPC error for batch ${batch.batch_number}:`, rpcError);
        
        // Mark batch as failed
        await supabase
          .from('sync_batches')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: [{ message: rpcError.message }]
          })
          .eq('id', batch.id);

        // Update sync log progress
        await supabase.rpc('update_sync_log_progress', { p_sync_log_id: syncLogId });
        
        continue; // Continue with next batch instead of failing entire sync
      }

      console.log(`✅ Batch ${batch.batch_number} completed via RPC:`, result);

      // Update sync log timestamp to show activity (every 10 batches)
      if ((i + 1) % 10 === 0) {
        await supabase
          .from('sync_logs')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', syncLogId);
      }
    }

    // Check if there are more batches to process
    const remainingBatches = totalPending - batchesToProcess.length;
    
    if (remainingBatches > 0) {
      console.log(`🔄 ${remainingBatches} batches remaining, triggering continuation...`);
      
      // Update sync log timestamp before continuation
      await supabase
        .from('sync_logs')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', syncLogId);
      
      // Trigger self to continue processing
      await triggerContinuation(syncLogId, trigger);
    } else {
      // All done - finalize
      console.log('✅ All batches completed, finalizing sync...');
      await finalizeSyncAndNotify(syncLogId, trigger, supabase, startTime);
    }

  } catch (error) {
    console.error('❌ Background processing error:', error);
    
    await supabase
      .from('sync_logs')
      .update({
        status: 'failed',
        error_details: [{ message: error instanceof Error ? error.message : String(error) }],
      })
      .eq('id', syncLogId);
  }
}

// Finalize sync and send notification
async function finalizeSyncAndNotify(syncLogId: string, trigger: string, supabase: any, startTime: number) {
  const duration = Date.now() - startTime;
  const durationMinutes = (duration / 1000 / 60).toFixed(2);

  // Update duration
  await supabase
    .from('sync_logs')
    .update({ duration_seconds: duration / 1000 })
    .eq('id', syncLogId);

  // Get final stats
  const { data: finalLog } = await supabase
    .from('sync_logs')
    .select('*')
    .eq('id', syncLogId)
    .single();

  // Get failed records details from batches
  const { data: failedBatches } = await supabase
    .from('sync_batches')
    .select('error_details')
    .eq('sync_log_id', syncLogId)
    .not('error_details', 'is', null);

  const allErrors = failedBatches?.flatMap((b: any) => b.error_details || []) || [];

  // Send email notification
  await sendAdminNotification({
    syncId: syncLogId,
    trigger,
    status: finalLog?.status || 'completed',
    recordsProcessed: finalLog?.items_fetched || 0,
    recordsInserted: finalLog?.items_inserted || 0,
    recordsUpdated: finalLog?.items_updated || 0,
    recordsFailed: finalLog?.items_failed || 0,
    duration: `${durationMinutes} minutes`,
    failedRecords: allErrors.length > 0 ? allErrors : null,
    supabase,
  });

  console.log(`✅ Sync finalized in ${durationMinutes} minutes (this invocation)`);
}

// Process remaining batches (for resume functionality)
async function processRemainingBatches(syncLogId: string, trigger: string, supabase: any) {
  const startTime = Date.now();
  console.log(`🔄 Processing remaining batches for sync: ${syncLogId}`);

  try {
    // Get all pending or failed batches
    const { data: batches, error: batchError } = await supabase
      .from('sync_batches')
      .select('id, batch_number')
      .eq('sync_log_id', syncLogId)
      .in('status', ['pending', 'failed'])
      .order('batch_number', { ascending: true });

    if (batchError) {
      throw new Error(`Failed to fetch batches: ${batchError.message}`);
    }

    console.log(`📦 Found ${batches?.length || 0} pending/failed batches to process`);

    if (!batches || batches.length === 0) {
      console.log('✅ No pending batches to process');
      
      await supabase
        .from('sync_logs')
        .update({ status: 'completed' })
        .eq('id', syncLogId);
      
      return;
    }

    // Reset failed batches to pending before processing
    await supabase
      .from('sync_batches')
      .update({ status: 'pending', error_details: null })
      .eq('sync_log_id', syncLogId)
      .eq('status', 'failed');

    // Process up to BATCHES_PER_INVOCATION batches
    const batchesToProcess = batches.slice(0, BATCHES_PER_INVOCATION);
    console.log(`📦 Processing ${batchesToProcess.length} of ${batches.length} batches (resume)`);

    for (let i = 0; i < batchesToProcess.length; i++) {
      const batch = batchesToProcess[i];
      console.log(`📦 Processing batch ${batch.batch_number} via RPC (resume) (${i + 1}/${batchesToProcess.length})`);
      
      const { data: result, error: rpcError } = await supabase.rpc('process_sync_batch', {
        p_batch_id: batch.id
      });

      if (rpcError) {
        console.error(`❌ RPC error for batch ${batch.batch_number}:`, rpcError);
        
        await supabase
          .from('sync_batches')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: [{ message: rpcError.message }]
          })
          .eq('id', batch.id);

        await supabase.rpc('update_sync_log_progress', { p_sync_log_id: syncLogId });
        continue;
      }

      console.log(`✅ Batch ${batch.batch_number} completed via RPC:`, result);

      // Update sync log timestamp to show activity (every 10 batches)
      if ((i + 1) % 10 === 0) {
        await supabase
          .from('sync_logs')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', syncLogId);
      }
    }

    // Check if there are more batches to process
    const remainingBatches = batches.length - batchesToProcess.length;
    
    if (remainingBatches > 0) {
      console.log(`🔄 ${remainingBatches} batches remaining, triggering continuation...`);
      
      // Update sync log timestamp before continuation
      await supabase
        .from('sync_logs')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', syncLogId);
      
      // Trigger self to continue processing (use continue_sync_id)
      await triggerContinuation(syncLogId, `${trigger} (resumed)`);
    } else {
      // All done - finalize
      console.log('✅ Resume completed, finalizing sync...');
      await finalizeSyncAndNotify(syncLogId, `${trigger} (resumed)`, supabase, startTime);
    }

  } catch (error) {
    console.error('❌ Resume processing error:', error);
    
    await supabase
      .from('sync_logs')
      .update({
        status: 'failed',
        error_details: [{ message: error instanceof Error ? error.message : String(error) }],
      })
      .eq('id', syncLogId);
  }
}

async function sendAdminNotification(params: {
  syncId: string;
  trigger: string;
  status: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  duration: string;
  failedRecords: any;
  supabase: any;
}) {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('⚠️ RESEND_API_KEY not configured, skipping email notification');
      return;
    }

    // Get all admin user IDs
    const { data: adminRoles } = await params.supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin', 'platform_admin']);

    if (!adminRoles || adminRoles.length === 0) {
      console.log('⚠️ No admin users found for notification');
      return;
    }

    const adminUserIds = adminRoles.map((r: any) => r.user_id);

    // Get admin emails
    const { data: admins } = await params.supabase
      .from('profiles')
      .select('email, full_name')
      .in('id', adminUserIds);

    if (!admins || admins.length === 0) {
      console.log('⚠️ No admin emails found for notification');
      return;
    }

    const adminEmails = admins.map((a: any) => a.email).filter(Boolean);
    
    if (adminEmails.length === 0) {
      console.log('⚠️ No valid admin emails found');
      return;
    }

    const statusEmoji = params.status === 'completed' ? '✅' : 
                       params.status === 'partial' ? '⚠️' : '❌';
    
    const failedRecordsHtml = params.recordsFailed > 0 && params.failedRecords
      ? `
        <h3>Failed Records (${params.recordsFailed}):</h3>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px;">
${JSON.stringify(params.failedRecords.slice(0, 50), null, 2)}
${params.failedRecords.length > 50 ? `\n... and ${params.failedRecords.length - 50} more` : ''}
        </pre>
      `
      : '<p style="color: green;">✅ All records processed successfully!</p>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'RMPL System <noreply@redefinemarcom.in>',
        to: adminEmails,
        subject: `${statusEmoji} Master Sync ${params.status.toUpperCase()} - ${params.recordsProcessed} records processed`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">${statusEmoji} DemandCom → Master Sync Report</h1>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Sync ID:</strong> ${params.syncId}</p>
              <p><strong>Trigger:</strong> ${params.trigger}</p>
              <p><strong>Status:</strong> <span style="color: ${params.status === 'completed' ? 'green' : params.status === 'partial' ? 'orange' : 'red'};">${params.status.toUpperCase()}</span></p>
              <p><strong>Duration:</strong> ${params.duration}</p>
              <p><strong>Method:</strong> Optimized Postgres RPC (self-chaining)</p>
            </div>
            
            <h2 style="color: #333;">Results:</h2>
            <ul style="line-height: 1.8;">
              <li><strong>Processed:</strong> ${params.recordsProcessed}</li>
              <li><strong>Inserted:</strong> ${params.recordsInserted}</li>
              <li><strong>Updated:</strong> ${params.recordsUpdated}</li>
              <li><strong>Failed:</strong> ${params.recordsFailed}</li>
            </ul>
            
            ${failedRecordsHtml}
            
            <p style="margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">
              This is an automated notification from the RMPL Master Sync system.<br/>
              Sync runs daily at 3:00 PM UTC (8:30 PM IST).
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error: ${errorText}`);
    }

    console.log('✅ Admin notification email sent successfully');
  } catch (error) {
    console.error('❌ Failed to send admin notification:', error);
  }
}
