import { corsHeaders } from '../_shared/cors-headers.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { successResponse, errorResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

interface ImportRequest {
  import_id: string;
  table_name?: string;
  continue_import_id?: string; // For self-chaining
}

const BATCH_SIZE = 1000; // Records per batch
const BATCHES_PER_INVOCATION = 50; // Process 50K records before self-chain

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📦 Background import process initiated');
    
    const supabase = createSupabaseClient();
    const authHeader = req.headers.get('Authorization');

    const { import_id, table_name, continue_import_id }: ImportRequest = 
      await req.json().catch(() => ({}));

    // Handle self-continuation (no auth check needed - internal call with service key)
    if (continue_import_id) {
      console.log(`🔄 Continuing import: ${continue_import_id}`);
      
      // Verify import exists and is still processing
      const { data: existingImport, error: importError } = await supabase
        .from('bulk_import_history')
        .select('*')
        .eq('id', continue_import_id)
        .eq('status', 'processing')
        .single();

      if (importError || !existingImport) {
        console.log('⚠️ Import not found or not processing, skipping continuation');
        return successResponse({ success: true, message: 'Import not active, skipping' });
      }

      // Update import timestamp to show activity
      await supabase
        .from('bulk_import_history')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', continue_import_id);

      // Process next chunk of batches
      EdgeRuntime.waitUntil(processImportBatches(continue_import_id, existingImport.table_name, supabase, true));

      return successResponse({
        success: true,
        importId: continue_import_id,
        status: 'continuing',
        message: 'Processing next chunk of batches.',
      });
    }

    // Verify authorization for new imports
    if (!authHeader) {
      return unauthorizedResponse('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return unauthorizedResponse('Invalid authentication');
    }

    if (!import_id || !table_name) {
      return errorResponse('Missing required fields: import_id, table_name', 400);
    }

    // Currently only master table uses background processing
    if (table_name !== 'master') {
      return errorResponse('Background import only supports master table', 400);
    }

    // Get import details
    const { data: importRecord, error: getError } = await supabase
      .from('bulk_import_history')
      .select('*')
      .eq('id', import_id)
      .single();

    if (getError || !importRecord) {
      return errorResponse('Import not found', 404);
    }

    // Check for already running
    if (importRecord.status === 'processing') {
      // Check if it's stale (no update for 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      if (importRecord.updated_at > fiveMinutesAgo) {
        return errorResponse('Import already processing', 409);
      }
      console.log('⚠️ Import appears stale, resuming...');
    }

    // Get total records from staging
    const { count: stagingCount } = await supabase
      .from('import_staging')
      .select('*', { count: 'exact', head: true })
      .eq('import_id', import_id)
      .eq('processed', false);

    if (!stagingCount || stagingCount === 0) {
      return errorResponse('No staging records found for import', 400);
    }

    const totalBatches = Math.ceil(stagingCount / BATCH_SIZE);
    console.log(`📊 Total staging records: ${stagingCount}, Total batches: ${totalBatches}`);

    // Create batch entries
    const batches = Array.from({ length: totalBatches }, (_, i) => ({
      import_id: import_id,
      batch_number: i + 1,
      offset_start: i * BATCH_SIZE,
      batch_size: BATCH_SIZE,
      status: 'pending'
    }));

    if (batches.length > 0) {
      // Delete any existing batches for this import (in case of restart)
      await supabase
        .from('import_batches')
        .delete()
        .eq('import_id', import_id);

      // Insert new batches
      const { error: batchInsertError } = await supabase
        .from('import_batches')
        .insert(batches);

      if (batchInsertError) {
        throw new Error(`Failed to create batches: ${batchInsertError.message}`);
      }
      console.log(`✅ Created ${batches.length} batch entries`);
    }

    // Update import status to processing
    await supabase
      .from('bulk_import_history')
      .update({ 
        status: 'processing',
        total_batches: totalBatches,
        updated_at: new Date().toISOString()
      })
      .eq('id', import_id);

    // Start background processing
    EdgeRuntime.waitUntil(processImportBatches(import_id, table_name, supabase, false));

    // Return immediately with job info
    return successResponse({
      success: true,
      importId: import_id,
      status: 'started',
      totalRecords: stagingCount,
      totalBatches,
      message: 'Import started in background using optimized batch processing.',
    });

  } catch (error) {
    console.error('❌ Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(errorMessage, 500);
  }
});

// Trigger self-continuation by invoking this function again
async function triggerContinuation(importId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for continuation');
    return;
  }

  console.log(`🔄 Triggering continuation for import: ${importId}`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-import-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ continue_import_id: importId }),
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

// Process batches using the Postgres function
async function processImportBatches(importId: string, tableName: string, supabase: any, isContinuation: boolean) {
  const startTime = Date.now();
  console.log(`🚀 Starting background processing for ${tableName} (continuation: ${isContinuation})`);

  try {
    // Get all pending batches
    const { data: batches, error: batchError } = await supabase
      .from('import_batches')
      .select('id, batch_number')
      .eq('import_id', importId)
      .eq('status', 'pending')
      .order('batch_number', { ascending: true });

    if (batchError) {
      throw new Error(`Failed to fetch batches: ${batchError.message}`);
    }

    const totalPending = batches?.length || 0;
    console.log(`📦 Found ${totalPending} pending batches`);

    if (totalPending === 0) {
      // All batches done - finalize the import
      console.log('✅ All batches completed, finalizing import...');
      await finalizeImport(importId, supabase, startTime);
      return;
    }

    // Process up to BATCHES_PER_INVOCATION batches
    const batchesToProcess = batches.slice(0, BATCHES_PER_INVOCATION);
    console.log(`📦 Processing ${batchesToProcess.length} of ${totalPending} pending batches`);

    for (let i = 0; i < batchesToProcess.length; i++) {
      const batch = batchesToProcess[i];
      console.log(`📦 Processing batch ${batch.batch_number} via RPC (${i + 1}/${batchesToProcess.length})`);
      
      const { data: result, error: rpcError } = await supabase.rpc('process_master_import_batch', {
        p_batch_id: batch.id
      });

      if (rpcError) {
        console.error(`❌ RPC error for batch ${batch.batch_number}:`, rpcError);
        
        // Mark batch as failed
        await supabase
          .from('import_batches')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: [{ message: rpcError.message }]
          })
          .eq('id', batch.id);

        // Update import progress
        await supabase.rpc('update_import_progress', { p_import_id: importId });
        
        continue; // Continue with next batch instead of failing entire import
      }

      console.log(`✅ Batch ${batch.batch_number} completed:`, result);

      // Update import timestamp and progress every 10 batches
      if ((i + 1) % 10 === 0) {
        await supabase.rpc('update_import_progress', { p_import_id: importId });
        await supabase
          .from('bulk_import_history')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', importId);
      }
    }

    // Update progress after this chunk
    await supabase.rpc('update_import_progress', { p_import_id: importId });

    // Check if there are more batches to process
    const remainingBatches = totalPending - batchesToProcess.length;
    
    if (remainingBatches > 0) {
      console.log(`🔄 ${remainingBatches} batches remaining, triggering continuation...`);
      
      // Update import timestamp before continuation
      await supabase
        .from('bulk_import_history')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', importId);
      
      // Trigger self to continue processing
      await triggerContinuation(importId);
    } else {
      // All done - finalize
      console.log('✅ All batches completed, finalizing import...');
      await finalizeImport(importId, supabase, startTime);
    }

  } catch (error) {
    console.error('❌ Background processing error:', error);
    
    await supabase
      .from('bulk_import_history')
      .update({
        status: 'failed',
        error_log: [{ message: error instanceof Error ? error.message : String(error) }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', importId);
  }
}

// Finalize the import
async function finalizeImport(importId: string, supabase: any, startTime: number) {
  const duration = Date.now() - startTime;
  const durationSeconds = duration / 1000;

  // Get final stats from batches
  const { data: stats } = await supabase
    .from('import_batches')
    .select('records_inserted, records_updated, records_failed, status')
    .eq('import_id', importId);

  const totalInserted = stats?.reduce((sum: number, b: any) => sum + (b.records_inserted || 0), 0) || 0;
  const totalUpdated = stats?.reduce((sum: number, b: any) => sum + (b.records_updated || 0), 0) || 0;
  const totalFailed = stats?.reduce((sum: number, b: any) => sum + (b.records_failed || 0), 0) || 0;
  const failedBatches = stats?.filter((b: any) => b.status === 'failed').length || 0;

  // Collect errors from failed batches
  const { data: failedBatchData } = await supabase
    .from('import_batches')
    .select('error_details')
    .eq('import_id', importId)
    .eq('status', 'failed');

  const allErrors = failedBatchData?.flatMap((b: any) => b.error_details || []) || [];

  // Determine final status
  let finalStatus = 'completed';
  if (totalInserted + totalUpdated === 0 && totalFailed > 0) {
    finalStatus = 'failed';
  } else if (totalFailed > 0 || failedBatches > 0) {
    finalStatus = 'partial';
  }

  // Update import history
  await supabase
    .from('bulk_import_history')
    .update({
      status: finalStatus,
      processed_records: totalInserted + totalUpdated + totalFailed,
      successful_records: totalInserted + totalUpdated,
      failed_records: totalFailed,
      error_log: allErrors.length > 0 ? allErrors.slice(0, 100) : null,
      completed_at: new Date().toISOString(),
      can_revert: totalInserted > 0,
    })
    .eq('id', importId);

  // Clean up staging data
  await supabase
    .from('import_staging')
    .delete()
    .eq('import_id', importId);

  console.log(`✅ Import finalized in ${durationSeconds.toFixed(2)}s. Status: ${finalStatus}, Inserted: ${totalInserted}, Updated: ${totalUpdated}, Failed: ${totalFailed}`);
}
