import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

// Reduced batch size to prevent CPU timeout - especially for demandcom imports with email-to-UUID lookups
const BATCH_SIZE = 500;
const MAX_RECORDS = 500000;

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

    const { tableName, fileName, totalRecords } = await req.json();
    
    if (!tableName || !fileName || !totalRecords) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (totalRecords > MAX_RECORDS) {
      return new Response(
        JSON.stringify({ 
          error: `Maximum ${MAX_RECORDS.toLocaleString()} records allowed per upload. Your file contains ${totalRecords.toLocaleString()} records.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate batches
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    console.log(`Import session for ${tableName}: ${totalRecords} records, batch size: ${BATCH_SIZE}, total batches: ${totalBatches}`);

    // Create import session
    const { data: importSession, error } = await supabase
      .from('bulk_import_history')
      .insert({
        user_id: user.id,
        table_name: tableName,
        file_name: fileName,
        total_records: totalRecords,
        total_batches: totalBatches,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating import session:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create batch records for queue system
    const batchRecords = [];
    for (let i = 0; i < totalBatches; i++) {
      batchRecords.push({
        import_id: importSession.id,
        batch_number: i + 1,
        offset_start: i * BATCH_SIZE,
        batch_size: Math.min(BATCH_SIZE, totalRecords - (i * BATCH_SIZE)),
        status: 'pending'
      });
    }

    // Insert batch records
    const { error: batchError } = await supabase
      .from('import_batches')
      .insert(batchRecords);

    if (batchError) {
      console.error('Error creating batch records:', batchError);
      // Clean up the import session if batch creation fails
      await supabase
        .from('bulk_import_history')
        .delete()
        .eq('id', importSession.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to create import batches' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created ${totalBatches} batch records for import ${importSession.id}`);

    return new Response(
      JSON.stringify({
        importId: importSession.id,
        totalBatches,
        batchSize: BATCH_SIZE
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-import-session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});