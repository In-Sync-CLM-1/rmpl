// Replays queued webhook payloads that arrived outside business hours.
// Triggered by pg_cron at 9:30 AM IST daily.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { WEBHOOK_REPLAY_HEADER } from "../_shared/business-hours.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InboxRow {
  id: string;
  webhook_name: string;
  method: string;
  payload: string | null;
  content_type: string | null;
  headers: Record<string, string> | null;
  query_params: Record<string, string> | null;
  attempt_count: number;
}

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let processed = 0;
  let failed = 0;

  try {
    while (true) {
      const { data: rows, error: fetchError } = await supabase
        .from("webhook_inbox")
        .select("id, webhook_name, method, payload, content_type, headers, query_params, attempt_count")
        .is("processed_at", null)
        .lt("attempt_count", MAX_ATTEMPTS)
        .order("received_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (fetchError) throw fetchError;
      if (!rows || rows.length === 0) break;

      for (const row of rows as InboxRow[]) {
        try {
          const queryString = row.query_params && Object.keys(row.query_params).length > 0
            ? "?" + new URLSearchParams(row.query_params).toString()
            : "";

          const targetUrl = `${supabaseUrl}/functions/v1/${row.webhook_name}${queryString}`;

          const replayHeaders: Record<string, string> = {
            ...(row.headers || {}),
            [WEBHOOK_REPLAY_HEADER]: row.id,
            authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          };

          // Strip headers that the runtime sets itself
          delete replayHeaders["host"];
          delete replayHeaders["content-length"];
          delete replayHeaders["connection"];

          if (row.content_type) {
            replayHeaders["content-type"] = row.content_type;
          }

          const resp = await fetch(targetUrl, {
            method: row.method || "POST",
            headers: replayHeaders,
            body: row.payload ?? undefined,
          });

          if (resp.ok) {
            await supabase
              .from("webhook_inbox")
              .update({
                processed_at: new Date().toISOString(),
                attempt_count: row.attempt_count + 1,
                processing_error: null,
              })
              .eq("id", row.id);
            processed++;
          } else {
            const errText = await resp.text().catch(() => `HTTP ${resp.status}`);
            await supabase
              .from("webhook_inbox")
              .update({
                attempt_count: row.attempt_count + 1,
                processing_error: `HTTP ${resp.status}: ${errText.slice(0, 500)}`,
              })
              .eq("id", row.id);
            failed++;
          }
        } catch (e: any) {
          await supabase
            .from("webhook_inbox")
            .update({
              attempt_count: row.attempt_count + 1,
              processing_error: (e?.message || String(e)).slice(0, 500),
            })
            .eq("id", row.id);
          failed++;
        }
      }

      if (rows.length < BATCH_SIZE) break;
    }

    return new Response(
      JSON.stringify({ ok: true, processed, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("process-webhook-inbox error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || String(e), processed, failed }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
