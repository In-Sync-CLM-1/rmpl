import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, otp } = await req.json();

    if (!sessionId || !otp) {
      return new Response(
        JSON.stringify({ error: "sessionId and otp are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the OTP record
    const { data: record, error: fetchError } = await supabase
      .from("public_otp_verifications")
      .select("*")
      .eq("session_id", sessionId)
      .is("verified_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (fetchError || !record) {
      return new Response(
        JSON.stringify({ error: "OTP expired or invalid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (record.attempts >= record.max_attempts) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Request a new OTP." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (record.otp_code !== otp) {
      // Increment attempts
      await supabase
        .from("public_otp_verifications")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);

      return new Response(
        JSON.stringify({
          error: "Incorrect OTP",
          attemptsRemaining: record.max_attempts - record.attempts - 1,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark verified
    await supabase
      .from("public_otp_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", record.id);

    return new Response(
      JSON.stringify({
        verified: true,
        identifier: record.identifier,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-otp error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
