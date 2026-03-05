import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;
    const payload = await req.json();
    const { ticketData } = payload;

    if (!ticketData || !ticketData.id) {
      return new Response(JSON.stringify({ error: 'Missing ticketData or ticketData.id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve org (single-tenant: first org)
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    const orgId = org?.id || null;

    const upsertData: Record<string, any> = {
      external_ticket_id: ticketData.id,
      ticket_number: ticketData.ticket_number || null,
      subject: ticketData.subject || null,
      description: ticketData.description || null,
      category: ticketData.category || null,
      priority: ticketData.priority || 'medium',
      status: ticketData.status || 'new',
      contact_name: ticketData.contact_name || null,
      contact_email: ticketData.contact_email || null,
      contact_phone: ticketData.contact_phone || null,
      source: ticketData.source || 'help_widget',
      org_id: orgId,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('crm_tickets')
      .upsert(upsertData, { onConflict: 'external_ticket_id' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
