import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { importId } = await req.json();
    
    if (!importId) {
      return new Response(
        JSON.stringify({ error: 'Missing importId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Completing import job ${importId}`);

    // Aggregate results from all batches using SQL SUM for accuracy
    const { data: aggregateData, error: aggError } = await supabase
      .from('import_batches')
      .select('records_processed, records_inserted, records_failed, status, batch_number, error_details')
      .eq('import_id', importId);

    if (aggError) {
      console.error('Error fetching batches:', aggError);
      throw new Error('Failed to fetch batch results');
    }

    const batches = aggregateData || [];
    console.log(`Found ${batches.length} batches for import ${importId}`);

    // Calculate totals with explicit number conversion to avoid null/undefined issues
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalFailed = 0;
    const allErrors: any[] = [];

    for (const batch of batches) {
      const processed = Number(batch.records_processed) || 0;
      const inserted = Number(batch.records_inserted) || 0;
      const failed = Number(batch.records_failed) || 0;
      
      console.log(`Batch ${batch.batch_number}: processed=${processed}, inserted=${inserted}, failed=${failed}, status=${batch.status}`);
      
      totalProcessed += processed;
      totalInserted += inserted;
      totalFailed += failed;
      
      if (batch.error_details) {
        if (Array.isArray(batch.error_details)) {
          allErrors.push(...batch.error_details);
        } else if (typeof batch.error_details === 'object' && batch.error_details.error) {
          allErrors.push({ batch: batch.batch_number, error: batch.error_details.error });
        }
      }
    }

    console.log(`Aggregated totals: processed=${totalProcessed}, inserted=${totalInserted}, failed=${totalFailed}`);

    // Determine final status
    const hasFailedBatches = batches.some(b => b.status === 'failed');
    const hasPendingBatches = batches.some(b => b.status === 'pending' || b.status === 'processing');
    
    let finalStatus = 'completed';
    if (hasPendingBatches) {
      finalStatus = 'partial';
    } else if (hasFailedBatches && totalInserted === 0) {
      finalStatus = 'failed';
    } else if (hasFailedBatches) {
      finalStatus = 'partial';
    }

    // Update import history with final results
    const { error: updateError } = await supabase
      .from('bulk_import_history')
      .update({
        status: finalStatus,
        processed_records: totalProcessed,
        successful_records: totalInserted,
        failed_records: totalFailed,
        error_log: allErrors.slice(0, 100), // Keep only first 100 errors
        completed_at: new Date().toISOString()
      })
      .eq('id', importId);

    if (updateError) {
      console.error('Error updating import history:', updateError);
      throw new Error('Failed to update import status');
    }

    console.log(`Import ${importId} completed: status=${finalStatus}, inserted=${totalInserted}, failed=${totalFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        totalProcessed,
        totalInserted,
        totalFailed,
        errorCount: allErrors.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in complete-import-job:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
