import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { maybeDeferWebhook } from "../_shared/business-hours.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const deferred = await maybeDeferWebhook(req, "exotel-webhook");
  if (deferred) return deferred;

  try {
    console.log("Exotel webhook received");

    const contentType = req.headers.get("content-type") || "";
    let payload: any = {};

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const formData = await req.formData();
      payload = Object.fromEntries(formData);
    }

    console.log("Webhook payload:", JSON.stringify(payload));

    const {
      CallSid,
      Sid,
      Status,
      CallStatus,
      ConversationDuration,
      Duration,
      RecordingUrl,
      StartTime,
      EndTime,
      Legs,
    } = payload;

    const callSid = CallSid || Sid;
    const status = (Status || CallStatus || "unknown").toLowerCase();

    // Exotel JSON callbacks may nest duration in Legs array
    let rawDuration = ConversationDuration || Duration || "0";
    let rawRecording = RecordingUrl;
    let rawEndTime = EndTime;
    let rawStartTime = StartTime;

    if (Array.isArray(Legs) && Legs.length > 0) {
      const leg = Legs[0];
      if (!parseInt(rawDuration, 10) && (leg.OnCallDuration || leg.Duration)) {
        rawDuration = leg.OnCallDuration || leg.Duration;
      }
      if (!rawRecording && leg.RecordingUrl) {
        rawRecording = leg.RecordingUrl;
      }
    }

    // Also handle nested Call object (Exotel passthrough API format)
    if (payload.Call) {
      const c = payload.Call;
      if (!callSid && c.Sid) Object.assign(payload, { CallSid: c.Sid });
      if (!parseInt(rawDuration, 10) && (c.ConversationDuration || c.Duration)) {
        rawDuration = c.ConversationDuration || c.Duration;
      }
      if (!rawRecording && c.RecordingUrl) rawRecording = c.RecordingUrl;
      if (!rawEndTime && c.EndTime) rawEndTime = c.EndTime;
      if (!rawStartTime && c.StartTime) rawStartTime = c.StartTime;
    }

    const duration = parseInt(String(rawDuration), 10) || 0;

    if (!callSid) {
      return new Response(
        JSON.stringify({ error: "Missing CallSid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating call: SID=${callSid}, Status=${status}, Duration=${duration}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (duration > 0) updateData.conversation_duration = duration;
    if (rawRecording) updateData.recording_url = rawRecording;
    if (rawEndTime) updateData.end_time = rawEndTime;
    if (rawStartTime) updateData.start_time = rawStartTime;
    updateData.exotel_response = payload;

    const { data, error } = await supabase
      .from("call_logs")
      .update(updateData)
      .eq("call_sid", callSid)
      .select();

    if (error) {
      console.error("Error updating call log:", error);
      return new Response(
        JSON.stringify({ error: "Failed to update call log", details: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Call log updated:", data);

    return new Response(
      JSON.stringify({ success: true, updated: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
