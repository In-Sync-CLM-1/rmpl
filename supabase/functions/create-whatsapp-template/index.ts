import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  example?: any;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string; example?: string[] }>;
}

interface CreateTemplateRequest {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  components: TemplateComponent[];
  allow_category_change?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateTemplateRequest = await req.json();
    const { name, category, language, components, allow_category_change } = body;

    if (!name || !category || !language || !components?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name, category, language, and components are required.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client to read settings (bypasses RLS)
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
        JSON.stringify({ success: false, error: 'WhatsApp not configured. Please set up WhatsApp settings.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const exotelSid = settings.exotel_sid || Deno.env.get('EXOTEL_SID');
    const exotelApiKey = settings.exotel_api_key || Deno.env.get('EXOTEL_API_KEY');
    const exotelApiToken = settings.exotel_api_token || Deno.env.get('EXOTEL_API_TOKEN');
    const exotelSubdomain = settings.exotel_subdomain || 'api.exotel.com';
    const wabaId = settings.waba_id;

    if (!exotelSid || !exotelApiKey || !exotelApiToken || !wabaId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Exotel credentials or WABA ID not configured.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Exotel payload
    const templatePayload: any = {
      category,
      name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      language,
      components,
    };
    if (allow_category_change) {
      templatePayload.allow_category_change = true;
    }

    const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${exotelSid}/templates?waba_id=${wabaId}`;

    console.log('Creating template:', JSON.stringify(templatePayload));

    const exotelResponse = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`,
      },
      body: JSON.stringify({
        whatsapp: {
          templates: [{ template: templatePayload }],
        },
      }),
    });

    const responseText = await exotelResponse.text();
    console.log('Exotel response:', responseText);

    let exotelResult: any;
    try {
      exotelResult = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse Exotel response', raw: responseText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const templateResponse = exotelResult?.response?.whatsapp?.templates?.[0];
    const templateId = templateResponse?.data?.id;
    const errorData = templateResponse?.error_data;

    if (errorData || !templateId) {
      const errorMsg = errorData?.description || errorData?.message || 'Failed to create template';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, details: exotelResult }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save template to local database
    const bodyComponent = components.find(c => c.type === 'BODY');
    const headerComponent = components.find(c => c.type === 'HEADER');
    const footerComponent = components.find(c => c.type === 'FOOTER');
    const buttonsComponent = components.find(c => c.type === 'BUTTONS');

    const bodyText = bodyComponent?.text || '';
    const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const variables = variableMatches.map((match: string, index: number) => ({
      index: index + 1,
      placeholder: match,
    }));

    await serviceClient.from('whatsapp_templates').upsert({
      template_id: templateId,
      template_name: templatePayload.name,
      category,
      language,
      content: bodyText,
      header_type: headerComponent?.format?.toLowerCase() || null,
      header_content: headerComponent?.text || null,
      footer_text: footerComponent?.text || null,
      buttons: buttonsComponent?.buttons || [],
      variables,
      status: 'pending',
      created_by_portal: true,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'template_id', ignoreDuplicates: false });

    return new Response(
      JSON.stringify({
        success: true,
        templateId,
        templateName: templatePayload.name,
        message: 'Template submitted for approval. It may take up to 24 hours for WhatsApp to review.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-whatsapp-template:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
