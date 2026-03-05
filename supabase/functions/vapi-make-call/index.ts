import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    if (!VAPI_API_KEY) throw new Error("VAPI_API_KEY is not configured");

    const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");
    if (!VAPI_ASSISTANT_ID) throw new Error("VAPI_ASSISTANT_ID is not configured");

    const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");
    if (!VAPI_PHONE_NUMBER_ID) throw new Error("VAPI_PHONE_NUMBER_ID is not configured");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { phone_number, contact_name, demandcom_id, first_message } = await req.json();

    if (!phone_number) throw new Error("phone_number is required");

    // Build VAPI call payload
    const vapiPayload: Record<string, unknown> = {
      assistantId: VAPI_ASSISTANT_ID,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: phone_number,
        name: contact_name || undefined,
      },
    };

    // Add first message override if provided
    if (first_message) {
      vapiPayload.assistantOverrides = {
        firstMessage: first_message,
      };
    }

    // Make VAPI API call
    const vapiResponse = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiPayload),
    });

    const vapiData = await vapiResponse.json();

    if (!vapiResponse.ok) {
      console.error("VAPI API error:", vapiData);
      throw new Error(vapiData.message || `VAPI API error: ${vapiResponse.status}`);
    }

    // Log the call in our database
    const { error: insertError } = await supabase
      .from("vapi_call_logs")
      .insert({
        demandcom_id: demandcom_id || null,
        vapi_call_id: vapiData.id,
        assistant_id: VAPI_ASSISTANT_ID,
        phone_number,
        contact_name: contact_name || null,
        status: vapiData.status || "queued",
        created_by: user.id,
      });

    if (insertError) {
      console.error("Failed to log call:", insertError);
    }

    return new Response(
      JSON.stringify({ success: true, call_id: vapiData.id, status: vapiData.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("vapi-make-call error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
