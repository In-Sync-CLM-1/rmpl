import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

const STAGING_BATCH_SIZE = 5000; // Records per staging insert

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { importId, records, tableName, isPartial, chunkNumber, totalChunks } = await req.json();

    if (!importId || !records || !tableName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: importId, records, tableName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only support demandcom and master for hybrid approach
    if (!['demandcom', 'master'].includes(tableName)) {
      return new Response(
        JSON.stringify({ error: 'Hybrid import only supports demandcom and master tables' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isLastChunk = !isPartial || chunkNumber === totalChunks;
    console.log(`[Hybrid Import] Processing chunk ${chunkNumber || 1}/${totalChunks || 1} for import ${importId} (${records.length} records, isLast: ${isLastChunk})`);

    // Check if import was cancelled
    const { data: importSession } = await supabase
      .from('bulk_import_history')
      .select('status, successful_records, failed_records')
      .eq('id', importId)
      .single();

    if (importSession?.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, cancelled: true, message: 'Import was cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing (only if not already processing)
    if (importSession?.status !== 'processing') {
      await supabase
        .from('bulk_import_history')
        .update({ status: 'processing' })
        .eq('id', importId);
    }

    // Step 1: Insert records into staging table in batches
    console.log(`[Hybrid Import] Inserting ${records.length} records into staging table`);
    const stagingStartTime = Date.now();

    // Calculate row offset based on chunk number for proper row numbering
    const rowOffset = isPartial ? (chunkNumber - 1) * records.length : 0;

    let stagingErrors = 0;
    for (let i = 0; i < records.length; i += STAGING_BATCH_SIZE) {
      const batch = records.slice(i, i + STAGING_BATCH_SIZE);
      const stagingRecords = batch.map((record: any, idx: number) => ({
        import_id: importId,
        row_number: rowOffset + i + idx + 1,
        raw_data: record,
        processed: false,
      }));

      const { error: stagingError } = await supabase
        .from('import_staging')
        .insert(stagingRecords);

      if (stagingError) {
        console.error(`[Hybrid Import] Staging insert error for batch ${i}:`, stagingError);
        stagingErrors++;
      }
    }

    const stagingDuration = Date.now() - stagingStartTime;
    console.log(`[Hybrid Import] Staging complete in ${stagingDuration}ms, errors: ${stagingErrors}`);

    // Step 2: Call Postgres function to process the import
    console.log(`[Hybrid Import] Calling process_bulk_import_batch function`);
    const processStartTime = Date.now();

    const { data: result, error: processError } = await supabase
      .rpc('process_bulk_import_batch', {
        p_import_id: importId,
        p_table_name: tableName,
        p_user_id: user.id,
        p_batch_size: records.length,
      });

    const processDuration = Date.now() - processStartTime;
    console.log(`[Hybrid Import] Processing complete in ${processDuration}ms`);

    if (processError) {
      console.error('[Hybrid Import] Process function error:', processError);

      // Always mark as failed when PG function errors — prevents stuck "processing" state
      await supabase
        .from('bulk_import_history')
        .update({
          status: 'failed',
          error_log: [{ message: processError.message }],
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);

      // Clean up staging data on failure
      await supabase
        .from('import_staging')
        .delete()
        .eq('import_id', importId);

      return new Response(
        JSON.stringify({ success: false, error: processError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { processed, inserted, updated, failed, errors } = result;

    console.log(`[Hybrid Import] Chunk results: processed=${processed}, inserted=${inserted}, updated=${updated || 0}, failed=${failed}`);

    // Accumulate totals from previous chunks
    const previousInserted = importSession?.successful_records || 0;
    const previousFailed = importSession?.failed_records || 0;
    const totalInserted = previousInserted + inserted;
    const totalUpdated = updated || 0;
    const totalFailed = previousFailed + failed;

    // Step 3: Update import history with accumulated results
    if (isLastChunk) {
      // Final chunk - set final status
      const finalStatus = totalFailed === 0 ? 'completed' : (totalInserted > 0 ? 'partial' : 'failed');
      
      await supabase
        .from('bulk_import_history')
        .update({
          status: finalStatus,
          processed_records: totalInserted + totalFailed,
          successful_records: totalInserted,
          failed_records: totalFailed,
          error_log: errors,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);

      console.log(`[Hybrid Import] Import ${importId} completed. Status: ${finalStatus}, Total inserted: ${totalInserted}`);
    } else {
      // Partial chunk - just update counts, keep processing status
      await supabase
        .from('bulk_import_history')
        .update({
          processed_records: totalInserted + totalFailed,
          successful_records: totalInserted,
          failed_records: totalFailed,
          current_batch: chunkNumber,
        })
        .eq('id', importId);
    }

    // Step 4: Clean up staging data for this chunk
    await supabase
      .from('import_staging')
      .delete()
      .eq('import_id', importId);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        inserted,
        updated: totalUpdated,
        failed,
        totalInserted,
        totalUpdated,
        totalFailed,
        errors: errors.slice(0, 100), // Limit errors returned
        status: isLastChunk ? (totalFailed === 0 ? 'completed' : 'partial') : 'processing',
        timing: {
          staging_ms: stagingDuration,
          processing_ms: processDuration,
          total_ms: stagingDuration + processDuration,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Hybrid Import] Unexpected error:', error);

    // Try to mark the import as failed so it doesn't stay stuck in "processing"
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      const body = await req.clone().json().catch(() => null);
      const importId = body?.importId;
      if (importId) {
        await supabaseAdmin
          .from('bulk_import_history')
          .update({
            status: 'failed',
            error_log: [{ message: error.message || 'Unexpected error' }],
            completed_at: new Date().toISOString(),
          })
          .eq('id', importId);

        await supabaseAdmin
          .from('import_staging')
          .delete()
          .eq('import_id', importId);
      }
    } catch (cleanupErr) {
      console.error('[Hybrid Import] Failed to update import status on error:', cleanupErr);
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
