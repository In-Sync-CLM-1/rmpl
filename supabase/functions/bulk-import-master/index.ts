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

    console.log(`Processing ${records.length} master records for user ${user.id}`);

    const errors: Array<{ row: number; message: string }> = [];
    let inserted = 0;
    let updated = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // Process each record in the batch
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const rowNumber = i + j + 1;

        // Validate required fields
        if (!record.name || !record.mobile_numb) {
          errors.push({
            row: rowNumber,
            message: 'Missing required fields: name and mobile_numb are required'
          });
          continue;
        }

        try {
          // Check if record exists by mobile_numb
          const { data: existingRecord, error: checkError } = await supabase
            .from('master')
            .select('mobile_numb')
            .eq('mobile_numb', record.mobile_numb)
            .maybeSingle();

          if (checkError) {
            console.error(`Error checking existing record for mobile ${record.mobile_numb}:`, checkError);
            errors.push({
              row: rowNumber,
              message: checkError.message || 'Database check failed'
            });
            continue;
          }

          if (existingRecord) {
            // Update existing record using COALESCE logic - only update if new value is not null/empty
            const updateData: Record<string, any> = {
              updated_at: new Date().toISOString()
            };

            // List of fields to update with COALESCE logic
            const fields = [
              'name', 'designation', 'deppt', 'job_level_updated', 'linkedin',
              'mobile2', 'official', 'personal_email_id', 'generic_email_id',
              'industry_type', 'sub_industry', 'company_name', 'address', 'location',
              'city', 'state', 'zone', 'tier', 'pincode', 'website', 'turnover',
              'emp_size', 'erp_name', 'erp_vendor', 'country', 'source', 'source_1',
              'extra', 'extra_1', 'extra_2', 'salutation', 'turnover_link',
              'company_linkedin_url', 'associated_member_linkedin', 'activity_name',
              'latest_disposition', 'latest_subdisposition'
            ];

            // Only include fields that have non-null, non-empty values
            for (const field of fields) {
              if (record[field] !== null && record[field] !== undefined && record[field] !== '') {
                updateData[field] = record[field];
              }
            }

            const { error: updateError } = await supabase
              .from('master')
              .update(updateData)
              .eq('mobile_numb', record.mobile_numb);

            if (updateError) {
              console.error(`Error updating record for mobile ${record.mobile_numb}:`, updateError);
              errors.push({
                row: rowNumber,
                message: updateError.message || 'Database update failed'
              });
            } else {
              updated++;
            }
          } else {
            // Insert new record
            const insertData = {
              ...record,
              created_by: user.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { error: insertError } = await supabase
              .from('master')
              .insert(insertData);

            if (insertError) {
              console.error(`Error inserting record for mobile ${record.mobile_numb}:`, insertError);
              errors.push({
                row: rowNumber,
                message: insertError.message || 'Database insert failed'
              });
            } else {
              inserted++;
            }
          }
        } catch (recordError) {
          console.error(`Error processing record at row ${rowNumber}:`, recordError);
          errors.push({
            row: rowNumber,
            message: recordError instanceof Error ? recordError.message : 'Unknown error'
          });
        }
      }
    }

    const response = {
      success: (inserted + updated) > 0,
      inserted,
      updated,
      failed: errors.length,
      total: records.length,
      errors: errors.slice(0, 100),
    };

    console.log('Import completed:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-import-master:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
