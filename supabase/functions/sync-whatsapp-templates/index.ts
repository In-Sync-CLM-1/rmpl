 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
 
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
 
     // Verify user is admin
     const token = authHeader.replace('Bearer ', '');
     const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
     if (claimsError || !claimsData?.claims) {
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Get WhatsApp settings
     const { data: settings, error: settingsError } = await supabase
       .from('whatsapp_settings')
       .select('*')
       .eq('is_active', true)
       .single();
 
     if (settingsError || !settings) {
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
 
     // Fetch templates from Exotel
     const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${exotelSid}/templates?waba_id=${wabaId}`;
     
     console.log('Fetching templates from:', exotelUrl);
 
     const response = await fetch(exotelUrl, {
       method: 'GET',
       headers: {
         'Authorization': `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`,
       },
     });
 
     const responseText = await response.text();
     console.log('Exotel templates response:', responseText);
 
     let exotelData: any;
     try {
       exotelData = JSON.parse(responseText);
     } catch {
       return new Response(
         JSON.stringify({ error: 'Failed to parse Exotel response', raw: responseText }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const templates = exotelData?.response?.whatsapp?.templates || [];
     console.log(`Found ${templates.length} templates`);
 
     let synced = 0;
     let errors: string[] = [];
 
     // Use service role for upserting templates
     const serviceClient = createClient(
       supabaseUrl,
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
       { auth: { persistSession: false } }
     );
 
     for (const template of templates) {
       const templateData = template.data || template;
       
       // Extract body content from components
       const bodyComponent = templateData.components?.find((c: any) => c.type === 'BODY');
       const headerComponent = templateData.components?.find((c: any) => c.type === 'HEADER');
       const footerComponent = templateData.components?.find((c: any) => c.type === 'FOOTER');
       const buttonsComponent = templateData.components?.find((c: any) => c.type === 'BUTTONS');
       
       // Extract variables from body text ({{1}}, {{2}}, etc.)
       const bodyText = bodyComponent?.text || '';
       const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
       const variables = variableMatches.map((match: string, index: number) => ({
         index: index + 1,
         placeholder: match,
       }));
 
       const { error: upsertError } = await serviceClient
         .from('whatsapp_templates')
         .upsert({
           template_id: templateData.id || templateData.name,
           template_name: templateData.name,
           category: templateData.category || 'UTILITY',
           language: templateData.language || 'en',
           content: bodyText,
           header_type: headerComponent?.format?.toLowerCase() || null,
           header_content: headerComponent?.text || null,
           footer_text: footerComponent?.text || null,
           buttons: buttonsComponent?.buttons || [],
           variables: variables,
           status: (templateData.status || 'pending').toLowerCase(),
           last_synced_at: new Date().toISOString(),
         }, { 
           onConflict: 'template_id',
           ignoreDuplicates: false 
         });
 
       if (upsertError) {
         console.error('Error upserting template:', templateData.name, upsertError);
         errors.push(`${templateData.name}: ${upsertError.message}`);
       } else {
         synced++;
       }
     }
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         synced, 
         total: templates.length,
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