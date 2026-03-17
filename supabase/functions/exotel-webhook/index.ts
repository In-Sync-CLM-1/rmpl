import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    } = payload;

    const callSid = CallSid || Sid;
    const status = (Status || CallStatus || "unknown").toLowerCase();
    const duration = parseInt(ConversationDuration || Duration || "0", 10);

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
    if (RecordingUrl) updateData.recording_url = RecordingUrl;
    if (EndTime) updateData.end_time = EndTime;
    if (StartTime) updateData.start_time = StartTime;

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
