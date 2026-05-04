import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

interface ScheduledEmailRow {
  id: string;
  mode: "individual" | "bulk";
  demandcom_id: string | null;
  filters: AppliedFilters | null;
  template_id: string | null;
  subject: string | null;
  body_html: string | null;
}

const MAX_PER_RUN = 25;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = getServiceClient();
    const resend = getResend();

    // Atomically claim due jobs. We update the status to 'processing' and
    // return only the rows we transitioned, preventing concurrent cron
    // invocations from picking up the same row.
    const { data: claimed, error: claimErr } = await serviceClient
      .from("scheduled_emails")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .select("id, mode, demandcom_id, filters, template_id, subject, body_html")
      .limit(MAX_PER_RUN);

    if (claimErr) throw claimErr;

    const rows = (claimed || []) as ScheduledEmailRow[];
    const summary: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      try {
        const result = await sendEmailJob(serviceClient, resend, {
          mode: row.mode,
          demandcomId: row.demandcom_id || undefined,
          filters: row.filters || undefined,
          templateId: row.template_id || undefined,
          subject: row.subject || undefined,
          bodyHtml: row.body_html || undefined,
        });

        await serviceClient
          .from("scheduled_emails")
          .update({
            status: "completed",
            sent_count: result.sent,
            skipped_count: result.skipped,
            failed_count: result.failed,
            total_count: result.total,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", row.id);

        summary.push({ id: row.id, status: "completed", ...result });
      } catch (err: any) {
        const message = (err && err.message) || String(err);
        console.error(`Scheduled email ${row.id} failed:`, message);
        await serviceClient
          .from("scheduled_emails")
          .update({
            status: "failed",
            error_message: message.slice(0, 500),
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        summary.push({ id: row.id, status: "failed", error: message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: rows.length, results: summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("process-scheduled-emails error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process scheduled emails" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
