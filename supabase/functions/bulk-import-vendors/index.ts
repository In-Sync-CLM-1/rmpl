import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { corsHeaders } from '../_shared/cors-headers.ts';

interface ValidRecord {
  vendor_name: string;
  vendor_type: string;
  contact_person: string | null;
  contact_no: string | null;
  email_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  gst: string | null;
  department: string | null;
  created_by: string;
  rowNumber: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { importId, batchNumber, records, tableName } = await req.json();

    if (!importId || !records || !Array.isArray(records) || tableName !== 'vendors') {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: importHistory } = await supabase
      .from('bulk_import_history')
      .select('status')
      .eq('id', importId)
      .single();

    if (importHistory?.status === 'cancelled') {
      return new Response(
        JSON.stringify({ status: 'cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (batchNumber === 1) {
      await supabase
        .from('bulk_import_history')
        .update({ status: 'processing' })
        .eq('id', importId);
    }

    const validTypes = ['IT', 'Operations', 'HRAF', 'Others'];
    const validRecords: ValidRecord[] = [];
    const errors: Array<{ row: number | string; error: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = (batchNumber - 1) * 250 + i + 1;

      if (!record.vendor_name || !record.vendor_type) {
        errors.push({ row: rowNumber, error: 'Vendor Name and Vendor Type are required' });
        continue;
      }

      if (!validTypes.includes(record.vendor_type)) {
        errors.push({ row: rowNumber, error: `Invalid Vendor Type. Must be one of: ${validTypes.join(', ')}` });
        continue;
      }

      if (record.contact_no && !/^\d{10,15}$/.test(record.contact_no.replace(/\s/g, ''))) {
        errors.push({ row: rowNumber, error: 'Contact No must be 10-15 digits' });
        continue;
      }

      if (record.email_id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email_id)) {
        errors.push({ row: rowNumber, error: 'Invalid Email format' });
        continue;
      }

      if (record.pin_code && !/^\d{6}$/.test(record.pin_code.replace(/\s/g, ''))) {
        errors.push({ row: rowNumber, error: 'Pin Code must be exactly 6 digits' });
        continue;
      }

      const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (record.gst && !gstPattern.test(record.gst.trim().toUpperCase())) {
        errors.push({ row: rowNumber, error: 'Invalid GST format (e.g., 27AABCU9603R1Z5)' });
        continue;
      }

      validRecords.push({
        vendor_name: record.vendor_name.trim(),
        vendor_type: record.vendor_type.trim(),
        contact_person: record.contact_person?.trim() || null,
        contact_no: record.contact_no?.replace(/\s/g, '') || null,
        email_id: record.email_id?.trim().toLowerCase() || null,
        address: record.address?.trim() || null,
        city: record.city?.trim() || null,
        state: record.state?.trim() || null,
        pin_code: record.pin_code?.replace(/\s/g, '') || null,
        gst: record.gst?.trim().toUpperCase() || null,
        department: record.department?.trim() || null,
        created_by: user.id,
        rowNumber
      });
    }

    let insertedCount = 0;

    if (validRecords.length > 0) {
      const recordsToInsert = validRecords.map(({ rowNumber, ...record }) => record);
      
      const { data: insertedData, error: insertError } = await supabase
        .from('vendors')
        .insert(recordsToInsert)
        .select('id');

      if (insertError) {
        console.error('Insert error:', insertError);
        errors.push({ row: 'batch', error: `Database error: ${insertError.message}` });
      } else if (insertedData) {
        insertedCount = insertedData.length;
        const importRecords = insertedData.map((record, index) => ({
          import_id: importId,
          record_id: record.id,
          row_number: validRecords[index].rowNumber,
          table_name: 'vendors'
        }));
        await supabase.from('bulk_import_records').insert(importRecords);
      }
    }

    const { data: currentHistory } = await supabase
      .from('bulk_import_history')
      .select('processed_records, successful_records, failed_records, error_log')
      .eq('id', importId)
      .single();

    const updatedProcessed = (currentHistory?.processed_records || 0) + records.length;
    const updatedSuccessful = (currentHistory?.successful_records || 0) + insertedCount;
    const updatedFailed = (currentHistory?.failed_records || 0) + (records.length - insertedCount);
    const currentErrors = (currentHistory?.error_log as any[]) || [];
    const updatedErrors = [...currentErrors, ...errors.slice(0, 100)];

    await supabase
      .from('bulk_import_history')
      .update({
        current_batch: batchNumber,
        processed_records: updatedProcessed,
        successful_records: updatedSuccessful,
        failed_records: updatedFailed,
        error_log: updatedErrors
      })
      .eq('id', importId);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        failed: records.length - insertedCount,
        errors: errors.slice(0, 10)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing vendors batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
