import { createServiceClient, createAuthenticatedClient } from '../_shared/supabase-client.ts';
import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { errorResponse } from '../_shared/response-helpers.ts';

const BATCH_SIZE = 50000; // 50K records per batch - Postgres RPC bypasses 1000 row limit

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, user, error: authError } = await verifyAuth(authHeader);

    if (!authenticated || !user) {
      return errorResponse(authError || 'Unauthorized', 401);
    }

    const { limit, resumeJobId } = await req.json().catch(() => ({}));
    const supabase = createAuthenticatedClient(authHeader!);
    const serviceClient = createServiceClient();

    // Check for resume
    if (resumeJobId) {
      return await resumeExport(serviceClient, resumeJobId);
    }

    // Get total count
    const { count: totalRecords, error: countError } = await supabase
      .from('demandcom')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Count error:', countError);
      return errorResponse('Failed to count records', 500, countError);
    }

    const recordsToExport = limit ? Math.min(limit, totalRecords || 0) : (totalRecords || 0);
    console.log(`Export requested: ${recordsToExport} records (total available: ${totalRecords})`);

    // For small exports (< 5000), do direct export using Postgres RPC
    if (recordsToExport <= 5000) {
      return await directExport(serviceClient, recordsToExport);
    }

    // For large exports, create job and use Postgres RPC
    const totalBatches = Math.ceil(recordsToExport / BATCH_SIZE);
    
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .insert({
        user_id: user.id,
        source: 'master',
        status: 'processing',
        total_records: recordsToExport,
        total_batches: totalBatches,
        current_batch: 0,
        processed_records: 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job creation error:', jobError);
      return errorResponse('Failed to create export job', 500, jobError);
    }

    console.log(`Created export job ${job.id} with ${totalBatches} batches`);

    // Process batches using Postgres RPC (fire and forget with waitUntil)
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(processExportBatches(serviceClient, job.id, totalBatches, recordsToExport));
    } else {
      // Fallback: process synchronously
      await processExportBatches(serviceClient, job.id, totalBatches, recordsToExport);
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: 'processing',
        totalRecords: recordsToExport,
        totalBatches,
        message: 'Export started. Processing batches using Postgres RPC...'
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Export error:', error);
    return errorResponse('Export failed', 500, error instanceof Error ? error.message : 'Unknown error');
  }
});

async function processExportBatches(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
  totalBatches: number,
  totalRecords: number
) {
  console.log(`Starting batch processing for job ${jobId} - ${totalBatches} batches, ${totalRecords} records`);
  const startTime = Date.now();

  try {
    // Process each batch using Postgres RPC
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      console.log(`Processing batch ${batchNum + 1}/${totalBatches}`);
      
      // Call Postgres function to generate CSV batch
      const { data: batchResult, error: batchError } = await supabase.rpc('process_export_batch', {
        p_job_id: jobId,
        p_batch_num: batchNum,
        p_batch_size: BATCH_SIZE
      });

      if (batchError) {
        console.error(`Batch ${batchNum} error:`, batchError);
        throw new Error(`Batch ${batchNum} failed: ${batchError.message}`);
      }

      const csvContent = batchResult?.csv_content || '';
      const recordsCount = batchResult?.records_count || 0;
      
      if (recordsCount === 0 && batchNum > 0) {
        console.log(`Batch ${batchNum} returned 0 records, stopping early`);
        break;
      }

      // Upload batch to storage
      const fileName = `${batchNum.toString().padStart(5, '0')}.csv`;
      const { error: uploadError } = await supabase.storage
        .from('exports')
        .upload(`temp/${jobId}/${fileName}`, csvContent, {
          contentType: 'text/csv',
          upsert: true
        });

      if (uploadError) {
        console.error(`Upload error for batch ${batchNum}:`, uploadError);
        throw new Error(`Failed to upload batch ${batchNum}`);
      }

      console.log(`Batch ${batchNum + 1} complete: ${recordsCount} records`);
    }

    // Assemble final file
    console.log('Assembling final CSV file...');
    await assembleExport(supabase, jobId, totalRecords);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Export job ${jobId} completed in ${duration}s`);

  } catch (error) {
    console.error(`Export job ${jobId} failed:`, error);
    
    await supabase
      .from('export_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

async function assembleExport(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
  totalRecords: number
) {
  // List all batch files
  const { data: files, error: listError } = await supabase.storage
    .from('exports')
    .list(`temp/${jobId}`, { sortBy: { column: 'name', order: 'asc' } });

  if (listError || !files?.length) {
    throw new Error('No batch files found');
  }

  console.log(`Assembling ${files.length} batch files`);

  // Download and concatenate all batches in parallel
  const PARALLEL_DOWNLOADS = 10;
  const fileContents: { name: string; content: string }[] = [];

  for (let i = 0; i < files.length; i += PARALLEL_DOWNLOADS) {
    const batch = files.slice(i, i + PARALLEL_DOWNLOADS);
    const results = await Promise.all(
      batch.map(async (file) => {
        const { data, error } = await supabase.storage
          .from('exports')
          .download(`temp/${jobId}/${file.name}`);

        if (error) {
          console.error(`Download error for ${file.name}:`, error);
          return { name: file.name, content: '' };
        }

        return { name: file.name, content: await data.text() };
      })
    );
    fileContents.push(...results);
  }

  // Sort and concatenate
  fileContents.sort((a, b) => a.name.localeCompare(b.name));
  const fullCsv = fileContents.map(f => f.content).join('');

  // Upload final file
  const finalFileName = `master-export-${jobId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
  const { error: uploadError } = await supabase.storage
    .from('exports')
    .upload(finalFileName, fullCsv, { contentType: 'text/csv', upsert: true });

  if (uploadError) {
    throw new Error(`Failed to upload final file: ${uploadError.message}`);
  }

  // Get signed URL (1 hour validity)
  const { data: urlData } = await supabase.storage
    .from('exports')
    .createSignedUrl(finalFileName, 3600);

  // Update job as completed
  await supabase
    .from('export_jobs')
    .update({
      status: 'completed',
      file_url: urlData?.signedUrl || finalFileName,
      processed_records: totalRecords,
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId);

  // Cleanup temp files in parallel
  const deletePromises = files.map(f => 
    supabase.storage.from('exports').remove([`temp/${jobId}/${f.name}`]).catch(() => {})
  );
  await Promise.all(deletePromises);

  console.log(`Final export file ready: ${finalFileName}`);
}

async function resumeExport(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string
) {
  const { data: job, error } = await supabase
    .from('export_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return errorResponse('Export job not found', 404);
  }

  if (job.status === 'completed') {
    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: 'completed',
        fileUrl: job.file_url,
        processedRecords: job.processed_records
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Resume from current batch
  const remainingBatches = (job.total_batches || 1) - (job.current_batch || 0);
  console.log(`Resuming job ${jobId} from batch ${job.current_batch}, ${remainingBatches} batches remaining`);

  // Update status
  await supabase
    .from('export_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  // Process remaining batches
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(processExportBatches(supabase, jobId, job.total_batches || 1, job.total_records || 0));
  }

  return new Response(
    JSON.stringify({
      jobId: job.id,
      status: 'resuming',
      currentBatch: job.current_batch,
      totalBatches: job.total_batches,
      message: 'Export resumed'
    }),
    { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function directExport(
  supabase: ReturnType<typeof createServiceClient>,
  limit: number
) {
  console.log(`Direct export for ${limit} records using Postgres RPC`);
  
  // Use RPC to generate CSV directly - bypasses 1000 row limit
  const { data: result, error } = await supabase.rpc('generate_master_export_batch', {
    p_batch_size: limit,
    p_offset: 0,
    p_include_header: true
  });

  if (error) {
    console.error('Direct export error:', error);
    return errorResponse('Export failed', 500, error);
  }

  const csvContent = result?.[0]?.csv_content || '';
  const fileName = `master-export-${new Date().toISOString().split('T')[0]}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv;charset=utf-8;',
      'Content-Disposition': `attachment; filename="${fileName}"`
    }
  });
}
