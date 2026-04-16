import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppliedFilters {
  nameEmail?: string;
  city?: string;
  activityName?: string;
  assignedTo?: string;
  disposition?: string[];
  subdisposition?: string[];
}

interface SendBulkWhatsAppRequest {
  mode: 'bulk';
  filters: AppliedFilters;
  templateId?: string;
  templateVariables?: Record<string, string>; // static fallback when no field mappings
  message?: string; // freeform
}

interface DemandComRecord {
  id: string;
  name: string;
  mobile_numb: string | null;
  company_name: string | null;
  designation: string | null;
  city: string | null;
  state: string | null;
  activity_name: string | null;
  personal_email_id: string | null;
  generic_email_id: string | null;
  deppt: string | null;
  industry_type: string | null;
  sub_industry: string | null;
  zone: string | null;
  tier: string | null;
  latest_disposition: string | null;
  latest_subdisposition: string | null;
  linkedin: string | null;
  website: string | null;
  turnover: string | null;
  emp_size: string | null;
  erp_name: string | null;
  erp_vendor: string | null;
  address: string | null;
  location: string | null;
  pincode: string | null;
  mobile2: string | null;
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) cleaned = '+91' + cleaned;
    else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = '+' + cleaned;
    else cleaned = '+' + cleaned;
  }
  return cleaned;
}

function phoneForExotel(phone: string): string {
  return normalizePhone(phone).replace(/^\+/, '');
}

function getFieldValue(record: DemandComRecord, fieldName: string): string {
  const val = (record as any)[fieldName];
  return val != null ? String(val) : '';
}

function resolveTemplateVariables(
  variables: Array<{ index: number; field_name?: string | null }>,
  record: DemandComRecord,
  staticVars?: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of variables) {
    if (v.field_name) {
      result[String(v.index)] = getFieldValue(record, v.field_name);
    } else if (staticVars?.[String(v.index)]) {
      result[String(v.index)] = staticVars[String(v.index)];
    } else {
      result[String(v.index)] = '';
    }
  }
  return result;
}

function applyFilters(query: any, filters: AppliedFilters): any {
  let q = query;
  if (filters.nameEmail) {
    const pat = `%${filters.nameEmail}%`;
    q = q.or(`name.ilike.${pat},personal_email_id.ilike.${pat},generic_email_id.ilike.${pat},mobile_numb.ilike.${pat}`);
  }
  if (filters.city) q = q.ilike('city', `%${filters.city}%`);
  if (filters.activityName) q = q.ilike('activity_name', `%${filters.activityName}%`);
  if (filters.assignedTo && filters.assignedTo !== 'all') {
    if (filters.assignedTo === 'unassigned') q = q.is('assigned_to', null);
    else q = q.eq('assigned_to', filters.assignedTo);
  }
  if (filters.disposition && filters.disposition.length > 0) {
    const hasNone = filters.disposition.includes('No Disposition');
    const real = filters.disposition.filter((d) => d !== 'No Disposition');
    if (hasNone && real.length > 0) q = q.or(`latest_disposition.is.null,latest_disposition.in.(${real.join(',')})`);
    else if (hasNone) q = q.is('latest_disposition', null);
    else q = q.in('latest_disposition', real);
  }
  if (filters.subdisposition && filters.subdisposition.length > 0) {
    q = q.in('latest_subdisposition', filters.subdisposition);
  }
  return q;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // WhatsApp settings
    const { data: settings, error: settingsError } = await serviceClient
      .from('whatsapp_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exotelSid = settings.exotel_sid || Deno.env.get('EXOTEL_SID');
    const exotelApiKey = settings.exotel_api_key || Deno.env.get('EXOTEL_API_KEY');
    const exotelApiToken = settings.exotel_api_token || Deno.env.get('EXOTEL_API_TOKEN');
    const exotelSubdomain = settings.exotel_subdomain || 'api.exotel.com';
    const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${exotelSid}/messages`;
    const authHeader64 = btoa(`${exotelApiKey}:${exotelApiToken}`);

    if (!exotelSid || !exotelApiKey || !exotelApiToken) {
      return new Response(JSON.stringify({ error: 'Exotel credentials not configured.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: SendBulkWhatsAppRequest = await req.json();
    const { filters, templateId, templateVariables, message } = body;

    if (!filters) {
      return new Response(JSON.stringify({ error: 'filters required for bulk mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve template if provided
    let templateName: string | null = null;
    let templateLanguage = 'en';
    let templateVarDefs: Array<{ index: number; field_name?: string | null }> = [];

    if (templateId) {
      const { data: tpl, error: tplErr } = await serviceClient
        .from('whatsapp_templates')
        .select('template_name, language, variables')
        .eq('id', templateId)
        .single();
      if (tplErr || !tpl) {
        return new Response(JSON.stringify({ error: 'Template not found' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      templateName = tpl.template_name;
      templateLanguage = tpl.language || 'en';
      templateVarDefs = (tpl.variables as any[]) || [];
    }

    // Fetch all filtered contacts in pages of 1000
    const FIELDS = 'id,name,mobile_numb,company_name,designation,city,state,activity_name,personal_email_id,generic_email_id,deppt,industry_type,sub_industry,zone,tier,latest_disposition,latest_subdisposition,linkedin,website,turnover,emp_size,erp_name,erp_vendor,address,location,pincode,mobile2';
    const PAGE_SIZE = 1000;
    let allRecords: DemandComRecord[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let q = serviceClient
        .from('demandcom' as any)
        .select(FIELDS)
        .range(from, from + PAGE_SIZE - 1);
      q = applyFilters(q, filters);
      const { data, error } = await q;
      if (error) throw error;
      const page = (data || []) as DemandComRecord[];
      allRecords = allRecords.concat(page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    const mobileRecords = allRecords.filter((r) => r.mobile_numb?.trim());
    const skipped = allRecords.length - mobileRecords.length;
    let sent = 0;
    let failed = 0;

    // Send in concurrent batches of 10
    const CONCURRENT = 10;
    for (let i = 0; i < mobileRecords.length; i += CONCURRENT) {
      const batch = mobileRecords.slice(i, i + CONCURRENT);
      await Promise.all(batch.map(async (record) => {
        try {
          const phoneDigits = phoneForExotel(record.mobile_numb!);

          let payload: any;

          if (templateName) {
            // Resolve variables: from field mappings if available, else static fallback
            const resolvedVars = resolveTemplateVariables(templateVarDefs, record, templateVariables);
            const bodyParams = Object.values(resolvedVars)
              .filter((v) => v !== undefined)
              .map((value) => ({ type: 'text', text: value }));

            payload = {
              whatsapp: {
                messages: [{
                  from: settings.whatsapp_source_number,
                  to: phoneDigits,
                  content: {
                    type: 'template',
                    template: {
                      name: templateName,
                      language: { code: templateLanguage },
                      components: bodyParams.length > 0
                        ? [{ type: 'body', parameters: bodyParams }]
                        : [],
                    },
                  },
                }],
              },
            };
          } else if (message) {
            payload = {
              whatsapp: {
                messages: [{
                  from: settings.whatsapp_source_number,
                  to: phoneDigits,
                  content: {
                    type: 'text',
                    text: { body: message },
                  },
                }],
              },
            };
          } else {
            return; // nothing to send
          }

          const res = await fetch(exotelUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authHeader64}`,
            },
            body: JSON.stringify(payload),
          });

          const resText = await res.text();
          let resJson: any;
          try { resJson = JSON.parse(resText); } catch { resJson = {}; }

          const sid = resJson?.response?.whatsapp?.messages?.[0]?.data?.sid || null;
          const success = res.ok;

          // Log to whatsapp_messages
          await serviceClient.from('whatsapp_messages').insert({
            demandcom_id: record.id,
            phone_number: normalizePhone(record.mobile_numb!),
            template_id: templateId || null,
            template_name: templateName,
            direction: 'outbound',
            status: success ? 'sent' : 'failed',
            message_content: templateName ? `[Template: ${templateName}]` : message || '',
            exotel_message_id: sid,
            sent_by: user.id,
            sent_at: new Date().toISOString(),
            error_message: success ? null : (resJson?.message || 'Send failed'),
          });

          if (success) sent++; else failed++;
        } catch (err) {
          console.error(`Failed for ${record.id}:`, err);
          failed++;
        }
      }));
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped, failed, total: allRecords.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-bulk-whatsapp error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
