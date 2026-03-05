import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActivityMapping {
  oldName: string;
  newName: string;
}

interface UpdateRequest {
  mappings?: ActivityMapping[];
  useDefaultMappings?: boolean;
}

// Default mappings based on user's spreadsheet
const DEFAULT_MAPPINGS: ActivityMapping[] = [
  { oldName: 'UKG HR Delhi Lot1-17-Dec-25', newName: 'UKG Global & LT Media - HR Roundtable' },
  { oldName: 'UKG HR Delhi 17-Dec-25', newName: 'UKG Global & LT Media - HR Roundtable' },
  { oldName: 'Delhi NCR Data Update', newName: 'Delhi NCR Data for IT Designation & ERP' },
  { oldName: 'SMB Delhi 18 Dec Lot1', newName: 'SMBConnect The Rise Delhi 18th December' },
  { oldName: 'IBM Ingram Delhi-19-Dec-25', newName: 'Ingram & IBM- Delhi Event-19th Dec' },
  { oldName: 'SMB chandigarh round table -Lot-2', newName: 'SMBConnect Roundtable Chandigarh' },
  { oldName: 'SMB -Chandigarh Round Table', newName: 'SMBConnect Roundtable Chandigarh' },
  { oldName: 'Ingram Bangalore', newName: 'Ingram Bangalore Internal Profiling' },
  { oldName: 'Salesforce Roundtable Event 17th December - Hyderabad', newName: 'Roundtable Hyderabad Event 17th December' },
  { oldName: 'SMBConnect Chandigarh 9th Dec Lot-2', newName: 'SMBConnect The Rise Chandigarh 9th Dec' },
  { oldName: 'Veeam V13 Launch 10th December', newName: 'Wysetek Veeam & AWS Event' },
  { oldName: 'SMB Connect Event Chandigarh 9th Dec', newName: 'SMBConnect The Rise Chandigarh 9th Dec' },
  { oldName: 'SMBConnect Chandigarh 9th Dec', newName: 'SMBConnect The Rise Chandigarh 9th Dec' },
  { oldName: 'BrandTap Hyderabad Lot1', newName: 'Brand Tap-Microsoft Webinar-03rd Dec' },
  { oldName: 'Autodesk Digital Factory Webinar 27th Nov', newName: 'Autodesk Digital Factory Webinar 27th November' },
  { oldName: 'Veeam Webinar 20th Nov 2025', newName: 'Veeam Webinar 20th November' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdateRequest = await req.json();
    const mappings = body.useDefaultMappings !== false ? DEFAULT_MAPPINGS : (body.mappings || []);

    if (!mappings.length) {
      return new Response(
        JSON.stringify({ error: 'No mappings provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${mappings.length} activity name mappings`);

    const results: { oldName: string; newName: string; updatedCount: number; error?: string }[] = [];
    let totalUpdated = 0;

    for (const mapping of mappings) {
      console.log(`Updating: "${mapping.oldName}" → "${mapping.newName}"`);

      try {
        // First get count of records to update
        const { count, error: countError } = await supabase
          .from('demandcom')
          .select('*', { count: 'exact', head: true })
          .eq('activity_name', mapping.oldName);

        if (countError) {
          console.error(`Count error for ${mapping.oldName}:`, countError);
          results.push({ ...mapping, updatedCount: 0, error: countError.message });
          continue;
        }

        const recordCount = count || 0;
        console.log(`Found ${recordCount} records for "${mapping.oldName}"`);

        if (recordCount === 0) {
          results.push({ ...mapping, updatedCount: 0 });
          continue;
        }

        // Process in batches of 500 to avoid timeouts
        const BATCH_SIZE = 500;
        let updatedInThisMapping = 0;

        for (let offset = 0; offset < recordCount; offset += BATCH_SIZE) {
          // Get batch of IDs
          const { data: batchRecords, error: batchError } = await supabase
            .from('demandcom')
            .select('id')
            .eq('activity_name', mapping.oldName)
            .range(offset, offset + BATCH_SIZE - 1);

          if (batchError) {
            console.error(`Batch fetch error at offset ${offset}:`, batchError);
            continue;
          }

          if (!batchRecords || batchRecords.length === 0) break;

          const batchIds = batchRecords.map(r => r.id);

          // Update the batch
          const { error: updateError } = await supabase
            .from('demandcom')
            .update({ activity_name: mapping.newName })
            .in('id', batchIds);

          if (updateError) {
            console.error(`Update error for batch at offset ${offset}:`, updateError);
          } else {
            updatedInThisMapping += batchIds.length;
            console.log(`Updated batch: ${batchIds.length} records (total: ${updatedInThisMapping}/${recordCount})`);
          }
        }

        results.push({ ...mapping, updatedCount: updatedInThisMapping });
        totalUpdated += updatedInThisMapping;

      } catch (err) {
        console.error(`Error processing mapping ${mapping.oldName}:`, err);
        results.push({ ...mapping, updatedCount: 0, error: String(err) });
      }
    }

    console.log(`Completed: ${totalUpdated} total records updated across ${mappings.length} mappings`);

    return new Response(
      JSON.stringify({
        success: true,
        totalUpdated,
        mappingsProcessed: mappings.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-demandcom-activity-names:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
