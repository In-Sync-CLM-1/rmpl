// Receives parsed email JSON from the Cloudflare Email Worker
// (cloudflare-workers/email-inbound) and writes it to email_inbox.
//
// Authenticated via a shared secret in the X-Inbound-Secret header.
// Threading rule: if the To address local-part matches reply+<token>, look up
// the email_activity_log row by id and link the inbox row to it. Otherwise
// fall back to matching by from-address against demandcom email columns.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-inbound-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InboundEmail {
  from: string;
  from_name?: string | null;
  to: string;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  message_id?: string | null;
  in_reply_to?: string | null;
  references?: string[] | string | null;
  attachments?: any[] | null;
  raw_headers?: Record<string, string> | null;
}

const TOKEN_PREFIX = "reply+";

function extractToken(toAddress: string): string | null {
  // local-part is before '@'
  const at = toAddress.indexOf("@");
  if (at < 0) return null;
  const local = toAddress.slice(0, at).toLowerCase();
  if (!local.startsWith(TOKEN_PREFIX)) return null;
  const token = local.slice(TOKEN_PREFIX.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }
  return token;
}

function normalizeEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim().toLowerCase();
}

function normalizeReferences(refs: string[] | string | null | undefined): string[] {
  if (!refs) return [];
  if (Array.isArray(refs)) return refs;
  return refs.split(/\s+/).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expectedSecret = Deno.env.get("INBOUND_EMAIL_SECRET");
  if (!expectedSecret) {
    console.error("INBOUND_EMAIL_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-inbound-secret");
  if (provided !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: InboundEmail;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload?.from || !payload?.to) {
    return new Response(JSON.stringify({ error: "Missing required fields: from, to" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const fromAddress = normalizeEmail(payload.from);
  const toAddress = normalizeEmail(payload.to);
  const token = extractToken(toAddress);

  let emailActivityLogId: string | null = null;
  let demandcomId: string | null = null;

  if (token) {
    const { data: log } = await supabase
      .from("email_activity_log")
      .select("id, demandcom_id")
      .eq("id", token)
      .maybeSingle();
    if (log) {
      emailActivityLogId = (log as any).id;
      demandcomId = (log as any).demandcom_id || null;
    }
  }

  // Fallback: try to match the sender to a demandcom contact.
  if (!demandcomId && fromAddress) {
    const { data: dc } = await supabase
      .from("demandcom")
      .select("id")
      .or(
        [
          `official.eq.${fromAddress}`,
          `personal_email_id.eq.${fromAddress}`,
          `generic_email_id.eq.${fromAddress}`,
        ].join(","),
      )
      .limit(1)
      .maybeSingle();
    if (dc) demandcomId = (dc as any).id;
  }

  const { error: insertErr } = await supabase.from("email_inbox").insert({
    received_at: new Date().toISOString(),
    from_address: fromAddress,
    from_name: payload.from_name || null,
    to_address: toAddress,
    subject: payload.subject || null,
    body_text: payload.text || null,
    body_html: payload.html || null,
    message_id: payload.message_id || null,
    in_reply_to: payload.in_reply_to || null,
    rfc_references: normalizeReferences(payload.references),
    thread_token: token,
    email_activity_log_id: emailActivityLogId,
    demandcom_id: demandcomId,
    is_read: false,
    raw_payload: payload as any,
    attachments: (payload.attachments || []) as any,
  });

  if (insertErr) {
    console.error("email_inbox insert error:", insertErr);
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      threaded: !!emailActivityLogId,
      matched_demandcom: !!demandcomId,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
