import { corsHeaders } from '../_shared/cors-headers.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';

interface ValidRecord {
  invoice_no: string;
  date_of_purchase: string;
  vendor_name: string;
  vendor_id: string | null;
  invoice_date: string;
  items: string;
  brand: string | null;
  model: string | null;
  item_description: string | null;
  quantity: number;
  rate: number;
  units: string;
  gst_slab: number;
  category: string;
  created_by: string;
  rowNumber: number;
}

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('/').map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createSupabaseClient(authHeader);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { records } = await req.json();
    
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('No records provided');
    }

    if (records.length > 5000) {
      throw new Error('Maximum 5000 records allowed per upload');
    }

    const validRecords: ValidRecord[] = [];
    const errors: { row: number; error: string; data?: any }[] = [];
    const invoiceNumbers = new Set<string>();

    // Validate each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 for header row and 1-based indexing

      // Check required fields
      if (!record.date_of_purchase || !record.vendor_name || !record.invoice_date || 
          !record.invoice_no || !record.items || !record.quantity || !record.rate || !record.units) {
        errors.push({ 
          row: rowNumber, 
          error: 'Missing required fields',
          data: record
        });
        continue;
      }

      // Validate and parse date_of_purchase
      const purchaseDate = parseDate(record.date_of_purchase);
      if (!purchaseDate) {
        errors.push({ 
          row: rowNumber, 
          error: 'Invalid Date of Purchase format (use DD/MM/YYYY)',
          data: record
        });
        continue;
      }

      // Validate and parse invoice_date
      const invoiceDate = parseDate(record.invoice_date);
      if (!invoiceDate) {
        errors.push({ 
          row: rowNumber, 
          error: 'Invalid Invoice Date format (use DD/MM/YYYY)',
          data: record
        });
        continue;
      }

      // Check invoice_no uniqueness within batch
      const invoiceNo = String(record.invoice_no).trim();
      if (invoiceNumbers.has(invoiceNo)) {
        errors.push({ 
          row: rowNumber, 
          error: `Duplicate Invoice No in CSV: ${invoiceNo}`,
          data: record
        });
        continue;
      }
      invoiceNumbers.add(invoiceNo);

      // Check if invoice_no already exists in database
      const { data: existing } = await supabase
        .from('inventory_items')
        .select('invoice_no')
        .eq('invoice_no', invoiceNo)
        .maybeSingle();

      if (existing) {
        errors.push({ 
          row: rowNumber, 
          error: `Invoice No already exists: ${invoiceNo}`,
          data: record
        });
        continue;
      }

      // Validate quantity
      const quantity = parseFloat(record.quantity);
      if (isNaN(quantity) || quantity < 1) {
        errors.push({ 
          row: rowNumber, 
          error: 'Quantity must be >= 1',
          data: record
        });
        continue;
      }

      // Validate rate
      const rate = parseFloat(record.rate);
      if (isNaN(rate) || rate < 0) {
        errors.push({ 
          row: rowNumber, 
          error: 'Rate must be >= 0',
          data: record
        });
        continue;
      }

      // Validate GST slab
      const validGstSlabs = [0, 5, 12, 18, 28, 40];
      const gstSlab = record.gst_slab ? parseFloat(record.gst_slab) : 18;
      if (!validGstSlabs.includes(gstSlab)) {
        errors.push({ 
          row: rowNumber, 
          error: 'Invalid GST Slab (allowed: 0, 5, 12, 18, 28, 40)',
          data: record
        });
        continue;
      }

      // Check if vendor exists (optional - we store vendor_name regardless)
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('vendor_name', record.vendor_name.trim())
        .maybeSingle();

      // Determine category - default to Operations
      const category = record.category?.trim() === 'IT' ? 'IT' : 'Operations';

      validRecords.push({
        invoice_no: invoiceNo,
        date_of_purchase: purchaseDate.toISOString().split('T')[0],
        vendor_name: record.vendor_name.trim(),
        vendor_id: vendor?.id || null,
        invoice_date: invoiceDate.toISOString().split('T')[0],
        items: record.items.trim(),
        brand: record.brand?.trim() || null,
        model: record.model?.trim() || null,
        item_description: record.item_description?.trim() || null,
        quantity,
        rate,
        units: record.units.trim(),
        gst_slab: gstSlab,
        category,
        created_by: user.id,
        rowNumber
      });
    }

    // Batch insert valid records
    // For IT items with quantity > 1, expand into individual line items
    let successfulInserts = 0;
    const BATCH_SIZE = 100;

    // Prepare all records for insertion, expanding IT items
    const allRecordsToInsert: any[] = [];
    for (const record of validRecords) {
      const { rowNumber, ...baseRecord } = record;
      
      if (baseRecord.category === 'IT' && baseRecord.quantity > 1) {
        // Create individual line items for IT inventory
        for (let lineNum = 1; lineNum <= baseRecord.quantity; lineNum++) {
          allRecordsToInsert.push({
            ...baseRecord,
            quantity: 1,
            line_number: lineNum,
          });
        }
      } else {
        allRecordsToInsert.push(baseRecord);
      }
    }

    for (let i = 0; i < allRecordsToInsert.length; i += BATCH_SIZE) {
      const batch = allRecordsToInsert.slice(i, i + BATCH_SIZE);
      
      const { error: insertError, count } = await supabase
        .from('inventory_items')
        .insert(batch);

      if (insertError) {
        console.error('Batch insert error:', insertError);
        // Track failed inserts
        successfulInserts -= batch.length;
      } else {
        successfulInserts += count || batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalRecords: records.length,
        totalItemsCreated: allRecordsToInsert.length,
        successfulInserts,
        failedInserts: errors.length,
        errors: errors.slice(0, 100) // Return first 100 errors
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Bulk import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
