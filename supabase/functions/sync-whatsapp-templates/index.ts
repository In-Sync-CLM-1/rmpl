 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };

 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }

   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

     const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } },
       auth: { persistSession: false },
     });

     // Verify user
     const { data: { user }, error: userError } = await supabase.auth.getUser();
     if (userError || !user) {
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     // Use service role to read settings (bypasses RLS)
     const serviceClient = createClient(
       supabaseUrl,
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
       { auth: { persistSession: false } }
     );

     // Get WhatsApp settings
     const { data: settings, error: settingsError } = await serviceClient
       .from('whatsapp_settings')
       .select('*')
       .eq('is_active', true)
       .single();

     if (settingsError || !settings) {
       console.error('Settings error:', settingsError);
       return new Response(
         JSON.stringify({ error: 'WhatsApp not configured' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     const exotelSid = settings.exotel_sid || Deno.env.get('EXOTEL_SID');
     const exotelApiKey = settings.exotel_api_key || Deno.env.get('EXOTEL_API_KEY');
     const exotelApiToken = settings.exotel_api_token || Deno.env.get('EXOTEL_API_TOKEN');
     const exotelSubdomain = settings.exotel_subdomain || 'api.exotel.com';
     const wabaId = settings.waba_id;

     if (!exotelSid || !exotelApiKey || !exotelApiToken) {
       return new Response(
         JSON.stringify({ error: 'Exotel credentials not configured' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     if (!wabaId) {
       return new Response(
         JSON.stringify({ error: 'WABA ID not configured' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     // Fetch ALL templates from Exotel with pagination
     const authHeader = `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`;
     const templates: any[] = [];
     let offset = 0;
     const limit = 100;

     while (true) {
       const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${exotelSid}/templates?waba_id=${wabaId}&limit=${limit}&offset=${offset}`;
       console.log('Fetching templates from:', exotelUrl);

       const response = await fetch(exotelUrl, {
         method: 'GET',
         headers: { 'Authorization': authHeader },
       });

       const responseText = await response.text();

       let exotelData: any;
       try {
         exotelData = JSON.parse(responseText);
       } catch {
         return new Response(
           JSON.stringify({ error: 'Failed to parse Exotel response', raw: responseText }),
           { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }

       const batch = exotelData?.response?.whatsapp?.templates || [];
       templates.push(...batch);
       console.log(`Fetched ${batch.length} templates (offset=${offset}, total so far=${templates.length})`);

       if (batch.length < limit) break;
       offset += limit;
     }

     console.log(`Found ${templates.length} total templates from Exotel`);

     let synced = 0;
     let errors: string[] = [];

     // Get existing portal-created templates to filter sync
     const { data: portalTemplates } = await serviceClient
       .from('whatsapp_templates')
       .select('template_id, template_name')
       .eq('created_by_portal', true);

     const portalTemplateIds = new Set((portalTemplates || []).map((t: any) => t.template_id));
     const portalTemplateNames = new Set((portalTemplates || []).map((t: any) => t.template_name));

     for (const template of templates) {
       const templateData = template.data || template;
       const exotelId = templateData.id || templateData.name;
       const exotelName = templateData.name;

       // Only sync templates that were created from this portal
       if (!portalTemplateIds.has(exotelId) && !portalTemplateNames.has(exotelName)) {
         continue;
       }

       // Extract body content from components
       const bodyComponent = templateData.components?.find((c: any) => c.type === 'BODY');
       const headerComponent = templateData.components?.find((c: any) => c.type === 'HEADER');
       const footerComponent = templateData.components?.find((c: any) => c.type === 'FOOTER');
       const buttonsComponent = templateData.components?.find((c: any) => c.type === 'BUTTONS');

       const bodyText = bodyComponent?.text || '';
       const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
       const variables = variableMatches.map((match: string, index: number) => ({
         index: index + 1,
         placeholder: match,
       }));

       const { error: upsertError } = await serviceClient
         .from('whatsapp_templates')
         .upsert({
           template_id: exotelId,
           template_name: exotelName,
           category: templateData.category || 'UTILITY',
           language: templateData.language || 'en',
           content: bodyText,
           header_type: headerComponent?.format?.toLowerCase() || null,
           header_content: headerComponent?.text || null,
           footer_text: footerComponent?.text || null,
           buttons: buttonsComponent?.buttons || [],
           variables: variables,
           status: (templateData.status || 'pending').toLowerCase(),
           created_by_portal: true,
           last_synced_at: new Date().toISOString(),
         }, {
           onConflict: 'template_id',
           ignoreDuplicates: false
         });

       if (upsertError) {
         console.error('Error upserting template:', exotelName, upsertError);
         errors.push(`${exotelName}: ${upsertError.message}`);
       } else {
         synced++;
       }
     }

     return new Response(
       JSON.stringify({
         success: true,
         synced,
         total: templates.length,
         portalTemplates: portalTemplateNames.size,
         errors: errors.length > 0 ? errors : undefined
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('Error in sync-whatsapp-templates:', error);
     return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });
