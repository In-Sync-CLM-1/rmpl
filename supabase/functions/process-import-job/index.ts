import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const MAX_CONCURRENT_BATCHES = 5;
const BATCH_SIZE = 500; // Reduced to prevent CPU timeout - matches create-import-session

async function processBatch(
  supabase: any,
  importId: string,
  batch: any,
  csvData: any[],
  tableName: string,
  userId: string
): Promise<{ success: boolean; inserted: number; failed: number }> {
  const startOffset = batch.offset_start;
  const endOffset = Math.min(startOffset + batch.batch_size, csvData.length);
  const batchRecords = csvData.slice(startOffset, endOffset);

  console.log(`Processing batch ${batch.batch_number}: records ${startOffset} to ${endOffset}`);

  // Update batch status to processing
  await supabase
    .from('import_batches')
    .update({
      status: 'processing',
      started_at: new Date().toISOString()
    })
    .eq('id', batch.id);

  try {
    // Call the existing process-import-batch function using service role key for internal calls
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/process-import-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'x-internal-call': 'true',
      },
      body: JSON.stringify({
        importId,
        batchNumber: batch.batch_number,
        records: batchRecords,
        tableName,
        userId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Batch processing failed');
    }

    // Update batch status to completed
    await supabase
      .from('import_batches')
      .update({
        status: 'completed',
        records_processed: batchRecords.length,
        records_inserted: result.inserted || 0,
        records_failed: result.failed || 0,
        error_details: result.errors || null,
        completed_at: new Date().toISOString()
      })
      .eq('id', batch.id);

    return {
      success: true,
      inserted: result.inserted || 0,
      failed: result.failed || 0
    };
  } catch (error: any) {
    console.error(`Batch ${batch.batch_number} failed:`, error);

    // Update batch status to failed
    await supabase
      .from('import_batches')
      .update({
        status: 'failed',
        error_details: { error: error.message },
        completed_at: new Date().toISOString()
      })
      .eq('id', batch.id);

    return {
      success: false,
      inserted: 0,
      failed: batchRecords.length
    };
  }
}

async function processImportJob(importId: string, csvData: any[], tableName: string, userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Starting import job ${importId} with ${csvData.length} records`);

  try {
    // Update import status to processing
    await supabase
      .from('bulk_import_history')
      .update({ status: 'processing' })
      .eq('id', importId);

    // Get all pending batches
    const { data: batches, error: batchError } = await supabase
      .from('import_batches')
      .select('*')
      .eq('import_id', importId)
      .eq('status', 'pending')
      .order('batch_number', { ascending: true });

    if (batchError) {
      throw new Error(`Failed to fetch batches: ${batchError.message}`);
    }

    if (!batches || batches.length === 0) {
      console.log('No pending batches found');
      return;
    }

    console.log(`Found ${batches.length} pending batches to process`);

    // Process batches in parallel with concurrency limit
    let currentIndex = 0;
    let totalInserted = 0;
    let totalFailed = 0;

    while (currentIndex < batches.length) {
      // Check if import was cancelled
      const { data: importStatus } = await supabase
        .from('bulk_import_history')
        .select('status')
        .eq('id', importId)
        .single();

      if (importStatus?.status === 'cancelled') {
        console.log('Import was cancelled, stopping processing');
        break;
      }

      // Get next batch of concurrent operations
      const concurrentBatches = batches.slice(currentIndex, currentIndex + MAX_CONCURRENT_BATCHES);
      
      // Process batches in parallel
      const results = await Promise.all(
        concurrentBatches.map(batch => 
          processBatch(supabase, importId, batch, csvData, tableName, userId)
        )
      );

      // Aggregate results
      for (const result of results) {
        totalInserted += result.inserted;
        totalFailed += result.failed;
      }

      // Update progress
      const completedBatches = currentIndex + concurrentBatches.length;
      await supabase
        .from('bulk_import_history')
        .update({
          current_batch: completedBatches,
          updated_at: new Date().toISOString()
        })
        .eq('id', importId);

      currentIndex += MAX_CONCURRENT_BATCHES;
      console.log(`Completed ${completedBatches}/${batches.length} batches`);
    }

    // Finalize import
    const { data: finalImport } = await supabase
      .from('bulk_import_history')
      .select('status')
      .eq('id', importId)
      .single();

    if (finalImport?.status !== 'cancelled') {
      await supabase
        .from('bulk_import_history')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', importId);
    }

    console.log(`Import job ${importId} completed: ${totalInserted} inserted, ${totalFailed} failed`);

  } catch (error: any) {
    console.error(`Import job ${importId} failed:`, error);
    
    await supabase
      .from('bulk_import_history')
      .update({
        status: 'failed',
        error_log: [{ message: error.message }]
      })
      .eq('id', importId);
  }
}

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

    const { importId, csvData, tableName } = await req.json();
    
    if (!importId || !csvData || !tableName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: importId, csvData, tableName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting background import job for ${importId} with ${csvData.length} records`);

    // Start background processing using waitUntil
    EdgeRuntime.waitUntil(processImportJob(importId, csvData, tableName, user.id));

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Import job started in background',
        importId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-import-job:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
