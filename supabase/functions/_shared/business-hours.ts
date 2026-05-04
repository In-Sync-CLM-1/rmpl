// Business-hours helper for inbound webhook deferral.
// Outside 9:30 AM – 8:00 PM IST, webhooks enqueue the raw payload to webhook_inbox
// and return 200 OK immediately. The process-webhook-inbox cron job replays them at 9:30 AM IST.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const BUSINESS_START_MIN = 9 * 60 + 30;
const BUSINESS_END_MIN = 20 * 60;
const REPLAY_HEADER = "x-webhook-replay";

export function isWithinBusinessHoursIST(date: Date = new Date()): boolean {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const istMinutes = (utcMinutes + 5 * 60 + 30) % (24 * 60);
  return istMinutes >= BUSINESS_START_MIN && istMinutes < BUSINESS_END_MIN;
}

/**
 * If outside business hours and this is not a replay, enqueue the request and return a 200 response.
 * Returns null if processing should continue normally.
 *
 * Usage:
 *   const deferred = await maybeDeferWebhook(req, "exotel-webhook");
 *   if (deferred) return deferred;
 *   // ... existing handler logic, reads req.body normally
 */
export async function maybeDeferWebhook(
  req: Request,
  webhookName: string,
): Promise<Response | null> {
  if (req.headers.get(REPLAY_HEADER)) return null;
  if (isWithinBusinessHoursIST()) return null;

  try {
    const cloned = req.clone();
    const bodyText = await cloned.text();

    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    const url = new URL(req.url);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await supabase.from("webhook_inbox").insert({
      webhook_name: webhookName,
      method: req.method,
      payload: bodyText,
      content_type: req.headers.get("content-type") ?? null,
      headers: headersObj,
      query_params: queryParams,
    });

    if (error) {
      console.error(`[${webhookName}] Failed to enqueue webhook, processing inline as fallback:`, error);
      return null;
    }

    return new Response(
      JSON.stringify({ deferred: true, message: "Queued for business-hours processing" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(`[${webhookName}] maybeDeferWebhook error, falling back to inline processing:`, e);
    return null;
  }
}

export const WEBHOOK_REPLAY_HEADER = REPLAY_HEADER;
