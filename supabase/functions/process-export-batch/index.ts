import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';

// Process a single batch using cursor-based pagination
// Supabase has HARD 1000 row limit - cannot be overridden
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    // Use service role for all operations - this function is called internally
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    
    // Support both old format (batchId) and new format (jobId, batchNum, lastId)
    let jobId = body.jobId;
    let batchNum = body.batchNum;
    let lastId = body.lastId;

    // If batchId is provided (old format from process-export-job), fetch batch details
    if (body.batchId) {
      const { data: batch, error: batchError } = await supabase
        .from('export_batches')
        .select('*, export_job_id')
        .eq('id', body.batchId)
        .single();

      if (batchError || !batch) {
        console.error('Batch not found:', batchError);
        return new Response(
          JSON.stringify({ error: 'Batch not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      jobId = batch.export_job_id;
      batchNum = batch.batch_number - 1; // Convert to 0-indexed
      
      // Update batch status to processing
      await supabase
        .from('export_batches')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', body.batchId);
    }
    
    if (!jobId || batchNum === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId or batchNum' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, cancelled: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const filters = job.filters as any;
    const columns: string[] = filters?.columns || [];
    // Supabase has HARD 1000 row limit - this CANNOT be changed
    const batchSize = 1000;
    const totalRecords = job.total_records || 0;

    // Use stored lastId if not provided (for resume)
    const cursorId = lastId || (filters?.lastId as string) || null;
    
    console.log(`Batch ${batchNum}, cursor: ${cursorId || 'start'}, totalRecords: ${totalRecords}`);

    // Use cursor-based pagination
    let query = supabase
      .from('demandcom')
      .select(columns.join(','))
      .order('id', { ascending: true })
      .limit(batchSize);

    // If we have a cursor, fetch records after it
    if (cursorId) {
      query = query.gt('id', cursorId);
    }

    const { data: records, error: fetchError } = await query;

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      
      // Update batch status if using batchId format
      if (body.batchId) {
        await supabase
          .from('export_batches')
          .update({ status: 'failed', error_message: fetchError.message })
          .eq('id', body.batchId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Fetch failed', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!records?.length) {
      console.log('No records found, export complete');
      
      if (body.batchId) {
        await supabase
          .from('export_batches')
          .update({ status: 'completed', records_processed: 0, completed_at: new Date().toISOString() })
          .eq('id', body.batchId);
      }
      
      return new Response(
        JSON.stringify({ success: true, recordCount: 0, isComplete: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the last ID for next batch
    const newLastId = (records[records.length - 1] as any).id;

    // Build CSV (header only on first batch)
    let csv = '';
    if (batchNum === 0) {
      csv = columns.map(c => c.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(',') + '\n';
    }

    for (const r of records) {
      csv += columns.map(c => {
        const v = (r as any)[c];
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',') + '\n';
    }

    // Upload to storage
    const fileName = `temp/${jobId}/${String(batchNum).padStart(5, '0')}.csv`;
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, csv, { contentType: 'text/csv', upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      if (body.batchId) {
        await supabase
          .from('export_batches')
          .update({ status: 'failed', error_message: uploadError.message })
          .eq('id', body.batchId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Upload failed', details: uploadError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate actual processed records
    const totalProcessed = (job.processed_records || 0) + records.length;
    
    // CRITICAL: Check completion based on TOTAL PROCESSED vs TOTAL RECORDS
    const isComplete = totalProcessed >= totalRecords || records.length === 0;

    // Update job with progress AND lastId for resume capability
    await supabase
      .from('export_jobs')
      .update({ 
        current_batch: batchNum + 1,
        processed_records: totalProcessed,
        status: isComplete ? 'assembling' : 'processing',
        filters: { ...filters, lastId: newLastId }
      })
      .eq('id', jobId);

    // Update batch status if using batchId format
    if (body.batchId) {
      await supabase
        .from('export_batches')
        .update({ 
          status: 'completed', 
          records_processed: records.length,
          completed_at: new Date().toISOString()
        })
        .eq('id', body.batchId);
    }

    console.log(`Batch ${batchNum} done: ${records.length} records, total: ${totalProcessed}/${totalRecords}, complete: ${isComplete}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordCount: records.length,
        processedRecords: totalProcessed,
        totalRecords: totalRecords,
        isComplete,
        nextBatch: isComplete ? null : batchNum + 1,
        lastId: newLastId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
