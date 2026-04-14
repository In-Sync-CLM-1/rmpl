import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATE_NAME = 'rmpl_invoice_reminder';
const TEMPLATE_BODY =
  'Dear {{1}},\n\nThis is a reminder to raise the invoice for project *{{2}}* (Event Date: {{3}}). It has been {{4}} days since the event concluded.\n\nPlease raise the invoice at your earliest convenience.\n\n- Redefine Marcom';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
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
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { exotel_sid, exotel_api_key, exotel_api_token, waba_id } = settings;
    const subdomain = settings.exotel_subdomain || 'api.exotel.com';

    if (!exotel_sid || !exotel_api_key || !exotel_api_token || !waba_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Exotel credentials or WABA ID not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const templatePayload = {
      category: 'UTILITY',
      name: TEMPLATE_NAME,
      language: 'en',
      allow_category_change: true,
      components: [
        {
          type: 'BODY',
          text: TEMPLATE_BODY,
          example: {
            body_text: [['Rahul Sharma', 'Brand Launch 2025', '05 Apr 2025', '7']],
          },
        },
      ],
    };

    const exotelUrl = `https://${subdomain}/v2/accounts/${exotel_sid}/templates?waba_id=${waba_id}`;

    console.log('Submitting template:', TEMPLATE_NAME);

    const exotelResponse = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${exotel_api_key}:${exotel_api_token}`)}`,
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

    // Save to whatsapp_templates table
    const { error: upsertError } = await serviceClient.from('whatsapp_templates').upsert(
      {
        template_id: templateId,
        template_name: TEMPLATE_NAME,
        category: 'UTILITY',
        language: 'en',
        content: TEMPLATE_BODY,
        variables: [
          { index: 1, placeholder: '{{1}}' },
          { index: 2, placeholder: '{{2}}' },
          { index: 3, placeholder: '{{3}}' },
          { index: 4, placeholder: '{{4}}' },
        ],
        status: 'pending',
        created_by_portal: true,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'template_id', ignoreDuplicates: false }
    );

    if (upsertError) {
      console.error('DB upsert error:', upsertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        templateId,
        templateName: TEMPLATE_NAME,
        message: 'Template submitted for WhatsApp approval. May take up to 24 hours.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in submit-invoice-reminder-template:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
