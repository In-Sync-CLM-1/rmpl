import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  AppliedFilters,
  getResend,
  getServiceClient,
  sendEmailJob,
} from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBulkEmailRequest {
  mode: "individual" | "bulk";
  demandcomId?: string;
  filters?: AppliedFilters;
  templateId?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  // ISO 8601 string. When set, the request is queued for later
  // delivery rather than sent immediately.
  scheduledFor?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = getServiceClient();

    const body: SendBulkEmailRequest = await req.json();
    const { mode, demandcomId, filters, templateId, subject, bodyHtml, bodyText, scheduledFor } = body;

    // ---- Schedule for later ----------------------------------------------
    if (scheduledFor) {
      const scheduledDate = new Date(scheduledFor);
      if (Number.isNaN(scheduledDate.getTime())) {
        return new Response(JSON.stringify({ error: "Invalid scheduledFor timestamp" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Allow a small clock-skew slack but reject sends scheduled in the past.
      if (scheduledDate.getTime() < Date.now() - 60_000) {
        return new Response(JSON.stringify({ error: "Scheduled time must be in the future" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate template exists if provided
      if (templateId) {
        const { error: tplErr } = await serviceClient
          .from("email_templates")
          .select("id")
          .eq("id", templateId)
          .single();
        if (tplErr) {
          return new Response(JSON.stringify({ error: "Email template not found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (!subject || !(bodyHtml || bodyText)) {
        return new Response(JSON.stringify({ error: "Missing subject or body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inserted, error: insertErr } = await serviceClient
        .from("scheduled_emails")
        .insert({
          mode,
          demandcom_id: mode === "individual" ? demandcomId : null,
          filters: mode === "bulk" ? filters || {} : null,
          template_id: templateId || null,
          subject: templateId ? null : (subject || null),
          body_html: templateId ? null : (bodyHtml || null),
          scheduled_for: scheduledDate.toISOString(),
          created_by: user.id,
          status: "pending",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      return new Response(
        JSON.stringify({
          success: true,
          scheduled: true,
          id: (inserted as { id: string }).id,
          scheduled_for: scheduledDate.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Send immediately ------------------------------------------------
    const resend = getResend();
    const result = await sendEmailJob(serviceClient, resend, {
      mode,
      demandcomId,
      filters,
      templateId,
      subject,
      bodyHtml,
      bodyText,
    });

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-bulk-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
