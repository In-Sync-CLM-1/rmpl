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

    console.log(`Processing ${records.length} client records for user ${user.id}`);

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
        if (!record.company_name) {
          errors.push({
            row: rowNumber,
            message: 'Missing required field: company_name is required'
          });
          return null;
        }

        if (!record.contact_name) {
          errors.push({
            row: rowNumber,
            message: 'Missing required field: contact_name is required'
          });
          return null;
        }

        // Validate email format if provided
        if (record.email_id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email_id)) {
          errors.push({
            row: rowNumber,
            message: 'Invalid email format for email_id'
          });
          return null;
        }

        // Validate LinkedIn URL format if provided
        if (record.company_linkedin_page && !/^https?:\/\/.+/.test(record.company_linkedin_page)) {
          errors.push({
            row: rowNumber,
            message: 'company_linkedin_page must be a valid URL (starting with http:// or https://)'
          });
          return null;
        }

        // Validate date formats if provided
        if (record.birthday_date && !/^\d{4}-\d{2}-\d{2}$/.test(record.birthday_date)) {
          errors.push({
            row: rowNumber,
            message: 'birthday_date must be in YYYY-MM-DD format'
          });
          return null;
        }

        if (record.anniversary_date && !/^\d{4}-\d{2}-\d{2}$/.test(record.anniversary_date)) {
          errors.push({
            row: rowNumber,
            message: 'anniversary_date must be in YYYY-MM-DD format'
          });
          return null;
        }

        return {
          company_name: record.company_name,
          contact_name: record.contact_name,
          official_address: record.official_address || null,
          residence_address: record.residence_address || null,
          contact_number: record.contact_number || null,
          email_id: record.email_id || null,
          birthday_date: record.birthday_date || null,
          anniversary_date: record.anniversary_date || null,
          company_linkedin_page: record.company_linkedin_page || null,
          linkedin_id: record.linkedin_id || null,
          created_by: user.id,
        };
      }).filter(Boolean);

      if (preparedRecords.length > 0) {
        const { data, error } = await supabase
          .from('clients')
          .insert(preparedRecords)
          .select();

        if (error) {
          console.error('Batch insert error:', error);
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
      errors: errors.slice(0, 100),
    };

    console.log('Import completed:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-import-clients:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
