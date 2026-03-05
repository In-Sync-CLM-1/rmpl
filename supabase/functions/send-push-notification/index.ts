import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    const { user_id, title, body, data } = payload;

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push subscription tokens
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("token, platform")
      .eq("user_id", user_id);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push subscriptions found for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const sub of subscriptions) {
      if (sub.platform === "android" || sub.platform === "ios") {
        // Send via FCM
        if (!fcmServerKey) {
          console.log("FCM_SERVER_KEY not configured, skipping native push");
          results.push({ platform: sub.platform, status: "skipped", reason: "FCM not configured" });
          continue;
        }

        try {
          const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${fcmServerKey}`,
            },
            body: JSON.stringify({
              to: sub.token,
              notification: {
                title,
                body,
                sound: "default",
                badge: 1,
              },
              data: data || {},
              priority: "high",
            }),
          });

          const fcmResult = await fcmResponse.json();
          results.push({ platform: sub.platform, status: "sent", result: fcmResult });
        } catch (fcmError) {
          console.error("FCM send error:", fcmError);
          results.push({ platform: sub.platform, status: "error", error: String(fcmError) });
        }
      } else if (sub.platform === "web") {
        // Web push would require Web Push API with VAPID keys
        // For now, we rely on the browser notification shown via realtime subscription
        results.push({ platform: "web", status: "skipped", reason: "Handled by client-side realtime" });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
