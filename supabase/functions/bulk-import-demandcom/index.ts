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

    const { records } = await req.json();
    
    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid input: records must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${records.length} demandcom records for user ${user.id}`);

    const errors: Array<{ row: number; message: string }> = [];
    let inserted = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // Prepare records with created_by
      const preparedRecords = batch.map((record, index) => {
        const rowNumber = i + index + 1;
        
        // Validate required fields
        if (!record.name || !record.mobile_numb) {
          errors.push({
            row: rowNumber,
            message: 'Missing required fields: name and mobile_numb are required'
          });
          return null;
        }

        return {
          ...record,
          created_by: user.id,
        };
      }).filter(Boolean);

      if (preparedRecords.length > 0) {
        const { data, error } = await supabase
          .from('demandcom')
          .insert(preparedRecords)
          .select();

        if (error) {
          console.error('Batch insert error:', error);
          // Add error for each record in the failed batch
          preparedRecords.forEach((_, index) => {
            errors.push({
              row: i + index + 1,
              message: error.message || 'Database insert failed'
            });
          });
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    const response = {
      success: inserted > 0,
      inserted,
      failed: errors.length,
      total: records.length,
      errors: errors.slice(0, 100), // Limit errors to first 100
    };

    console.log('Import completed:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-import-demandcom:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
