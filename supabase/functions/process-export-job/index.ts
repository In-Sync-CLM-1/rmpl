import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

interface ExportBatch {
  id: string;
  batch_number: number;
}

const BATCH_SIZE = 5000; // 5000 records per batch for 200K support
const MAX_CONCURRENT_BATCHES = 5; // Process up to 5 batches in parallel

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Job ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing export job: ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if batches already exist (resume scenario)
    const { data: existingBatches } = await supabase
      .from('export_batches')
      .select('id')
      .eq('export_job_id', jobId)
      .limit(1);

    if (existingBatches && existingBatches.length > 0) {
      console.log('Batches already exist for this job. Triggering batch processing.');
      
      // Trigger batch processing in background
      EdgeRuntime.waitUntil(triggerBatchProcessing(supabase, jobId, supabaseUrl));
      
      return new Response(
        JSON.stringify({ message: 'Export job resumed', jobId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update job status to processing
    await supabase
      .from('export_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    const { source, filters } = job;

    // Column mapping for count query
    const columnMap: Record<string, string[]> = {
      master: ['id'],
      clients: ['id'],
      demandcom: ['id'],
      projects: ['id']
    };

    // Build query to get count
    let countQuery = supabase.from(source).select('id', { count: 'exact', head: true });
    countQuery = applyFilters(countQuery, filters, source);

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Count error:', countError);
      await supabase
        .from('export_jobs')
        .update({
          status: 'failed',
          error_message: countError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to count records' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const totalRecords = count || 0;
    console.log(`Total records to export: ${totalRecords}`);

    if (totalRecords === 0) {
      await supabase
        .from('export_jobs')
        .update({
          status: 'completed',
          total_records: 0,
          processed_records: 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ message: 'No records to export' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate number of batches
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
    console.log(`Creating ${totalBatches} batches of ${BATCH_SIZE} records each`);

    // Create batch records
    const batchRecords = [];
    for (let i = 0; i < totalBatches; i++) {
      batchRecords.push({
        export_job_id: jobId,
        batch_number: i + 1,
        offset_start: i * BATCH_SIZE,
        batch_size: BATCH_SIZE,
        status: 'pending'
      });
    }

    const { error: batchInsertError } = await supabase
      .from('export_batches')
      .insert(batchRecords);

    if (batchInsertError) {
      console.error('Failed to create batches:', batchInsertError);
      await supabase
        .from('export_jobs')
        .update({
          status: 'failed',
          error_message: batchInsertError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to create batches' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Update job with total records and batches
    await supabase
      .from('export_jobs')
      .update({ 
        total_records: totalRecords,
        total_batches: totalBatches,
        current_batch: 0
      })
      .eq('id', jobId);

    console.log(`Created ${totalBatches} batches. Starting batch processing.`);

    // Trigger batch processing in background
    EdgeRuntime.waitUntil(triggerBatchProcessing(supabase, jobId, supabaseUrl));

    return new Response(
      JSON.stringify({ 
        message: 'Export job started',
        jobId,
        totalRecords,
        totalBatches
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Background task to process batches
async function triggerBatchProcessing(supabase: any, jobId: string, supabaseUrl: string) {
  try {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get all pending batches
    const { data: pendingBatches, error } = await supabase
      .from('export_batches')
      .select('id, batch_number')
      .eq('export_job_id', jobId)
      .eq('status', 'pending')
      .order('batch_number', { ascending: true });

    if (error || !pendingBatches || pendingBatches.length === 0) {
      console.log('No pending batches to process');
      return;
    }

    console.log(`Processing ${pendingBatches.length} pending batches in parallel (max ${MAX_CONCURRENT_BATCHES})`);

    // Process batches in groups of MAX_CONCURRENT_BATCHES
    for (let i = 0; i < pendingBatches.length; i += MAX_CONCURRENT_BATCHES) {
      const batchGroup: ExportBatch[] = pendingBatches.slice(i, i + MAX_CONCURRENT_BATCHES);
      
      console.log(`Processing batch group ${i / MAX_CONCURRENT_BATCHES + 1}: batches ${batchGroup.map((b: ExportBatch) => b.batch_number).join(', ')}`);
      
      // Process group in parallel
      await Promise.all(
        batchGroup.map(async (batch: ExportBatch) => {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/process-export-batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`
              },
              body: JSON.stringify({ batchId: batch.id })
            });

            if (!response.ok) {
              console.error(`Failed to process batch ${batch.batch_number}:`, await response.text());
            } else {
              console.log(`Batch ${batch.batch_number} processed successfully`);
            }
          } catch (err) {
            console.error(`Error processing batch ${batch.batch_number}:`, err);
          }
        })
      );
      
      // Small delay between batch groups to avoid overwhelming the system
      if (i + MAX_CONCURRENT_BATCHES < pendingBatches.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('All batches triggered');
  } catch (error) {
    console.error('Error in batch processing:', error);
  }
}

// Helper function to apply filters
function applyFilters(query: any, filters: any, source: string) {
  if (!filters) return query;

  if (filters.name?.value) {
    const nameField = source === 'clients' ? 'contact_name' : source === 'projects' ? 'project_name' : 'name';
    if (filters.name.operator === 'contains') query = query.ilike(nameField, `%${filters.name.value}%`);
    else if (filters.name.operator === 'equals') query = query.eq(nameField, filters.name.value);
    else if (filters.name.operator === 'starts_with') query = query.ilike(nameField, `${filters.name.value}%`);
  }

  if (filters.mobile?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.mobile.operator === 'contains') query = query.ilike('mobile_numb', `%${filters.mobile.value}%`);
    else if (filters.mobile.operator === 'equals') query = query.eq('mobile_numb', filters.mobile.value);
    else if (filters.mobile.operator === 'starts_with') query = query.ilike('mobile_numb', `${filters.mobile.value}%`);
  }

  if (filters.email?.value) {
    const emailFields = source === 'master' || source === 'demandcom' 
      ? ['official', 'personal_email_id', 'generic_email_id']
      : source === 'clients' ? ['email_id'] : [];
    if (emailFields.length > 0 && filters.email.operator === 'contains') {
      const orConditions = emailFields.map(field => `${field}.ilike.%${filters.email.value}%`).join(',');
      query = query.or(orConditions);
    }
  }

  if (filters.company?.value && (source === 'master' || source === 'demandcom' || source === 'clients')) {
    if (filters.company.operator === 'contains') query = query.ilike('company_name', `%${filters.company.value}%`);
    else if (filters.company.operator === 'equals') query = query.eq('company_name', filters.company.value);
    else if (filters.company.operator === 'starts_with') query = query.ilike('company_name', `${filters.company.value}%`);
  }

  if (filters.industryType?.length > 0) query = query.in('industry_type', filters.industryType);
  if (filters.subIndustry?.length > 0) query = query.in('sub_industry', filters.subIndustry);
  if (filters.city?.length > 0) query = query.in('city', filters.city);
  if (filters.state?.length > 0) query = query.in('state', filters.state);
  if (filters.zone?.length > 0) query = query.in('zone', filters.zone);
  if (filters.tier?.length > 0) query = query.in('tier', filters.tier);
  if (filters.designation?.length > 0 && (source === 'master' || source === 'demandcom')) {
    query = query.in('designation', filters.designation);
  }
  if (filters.department?.length > 0 && (source === 'master' || source === 'demandcom')) {
    query = query.in('deppt', filters.department);
  }
  if (filters.erpName?.length > 0 && (source === 'master' || source === 'demandcom')) {
    query = query.in('erp_name', filters.erpName);
  }
  if (filters.assignmentStatus?.length > 0 && source === 'demandcom') {
    query = query.in('assignment_status', filters.assignmentStatus);
  }
  if (filters.disposition?.length > 0 && source === 'demandcom') {
    if (filters.disposition.length >= 10) {
      const quotedValues = filters.disposition.map((d: string) => `"${d}"`).join(',');
      query = query.or(`latest_disposition.in.(${quotedValues}),latest_disposition.is.null`);
    } else {
      query = query.in('latest_disposition', filters.disposition);
    }
  }
  if (filters.subdisposition?.length > 0 && source === 'demandcom') {
    if (filters.subdisposition.length >= 20) {
      const quotedValues = filters.subdisposition.map((s: string) => `"${s}"`).join(',');
      query = query.or(`latest_subdisposition.in.(${quotedValues}),latest_subdisposition.is.null`);
    } else {
      query = query.in('latest_subdisposition', filters.subdisposition);
    }
  }
  if (filters.source?.length > 0 && source === 'demandcom') {
    query = query.in('source', filters.source);
  }
  if (filters.projectStatus?.length > 0 && source === 'projects') {
    query = query.in('status', filters.projectStatus);
  }

  if (filters.activityName?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.activityName.operator === 'contains') {
      query = query.ilike('activity_name', `%${filters.activityName.value}%`);
    } else if (filters.activityName.operator === 'equals') {
      query = query.eq('activity_name', filters.activityName.value);
    } else if (filters.activityName.operator === 'starts_with') {
      query = query.ilike('activity_name', `${filters.activityName.value}%`);
    }
  }

  if (filters.mobile2?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.mobile2.operator === 'contains') query = query.ilike('mobile2', `%${filters.mobile2.value}%`);
    else if (filters.mobile2.operator === 'equals') query = query.eq('mobile2', filters.mobile2.value);
    else if (filters.mobile2.operator === 'starts_with') query = query.ilike('mobile2', `${filters.mobile2.value}%`);
  }

  if (filters.linkedin?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.linkedin.operator === 'contains') query = query.ilike('linkedin', `%${filters.linkedin.value}%`);
    else if (filters.linkedin.operator === 'equals') query = query.eq('linkedin', filters.linkedin.value);
    else if (filters.linkedin.operator === 'starts_with') query = query.ilike('linkedin', `${filters.linkedin.value}%`);
  }

  if (filters.location?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.location.operator === 'contains') query = query.ilike('location', `%${filters.location.value}%`);
    else if (filters.location.operator === 'equals') query = query.eq('location', filters.location.value);
    else if (filters.location.operator === 'starts_with') query = query.ilike('location', `${filters.location.value}%`);
  }

  if (filters.createdDate?.from) query = query.gte('created_at', filters.createdDate.from);
  if (filters.createdDate?.to) query = query.lte('created_at', filters.createdDate.to);
  if (filters.lastCallDate?.from && (source === 'master' || source === 'demandcom')) {
    query = query.gte('last_call_date', filters.lastCallDate.from);
  }
  if (filters.lastCallDate?.to && (source === 'master' || source === 'demandcom')) {
    query = query.lte('last_call_date', filters.lastCallDate.to);
  }
  if (filters.nextCallDate?.from && (source === 'master' || source === 'demandcom')) {
    query = query.gte('next_call_date', filters.nextCallDate.from);
  }
  if (filters.nextCallDate?.to && (source === 'master' || source === 'demandcom')) {
    query = query.lte('next_call_date', filters.nextCallDate.to);
  }

  return query;
}
