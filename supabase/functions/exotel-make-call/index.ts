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
    const EXOTEL_API_KEY = Deno.env.get("EXOTEL_API_KEY");
    const EXOTEL_API_TOKEN = Deno.env.get("EXOTEL_API_TOKEN");
    const EXOTEL_SID = Deno.env.get("EXOTEL_SID");
    const EXOTEL_CALLER_ID_ENV = Deno.env.get("EXOTEL_CALLER_ID");

    if (!EXOTEL_API_KEY || !EXOTEL_API_TOKEN || !EXOTEL_SID) {
      return new Response(
        JSON.stringify({ success: false, error: "Exotel credentials not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: exophoneConfig } = await supabase
      .from("exotel_config")
      .select("exophone")
      .eq("is_active", true)
      .eq("is_default", true)
      .single();

    const EXOTEL_CALLER_ID = exophoneConfig?.exophone || EXOTEL_CALLER_ID_ENV;

    if (!EXOTEL_CALLER_ID) {
      return new Response(
        JSON.stringify({ success: false, error: "EXOPhone (Caller ID) not configured. Please add an EXOPhone number in Admin Settings." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      to_number,
      from_number,
      demandcom_id,
      custom_field,
      edited_contact_info = {},
      disposition = null,
      subdisposition = null,
      notes = null,
      next_call_date = null,
    } = await req.json();

    if (!to_number) {
      return new Response(
        JSON.stringify({ success: false, error: "Participant phone number is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!from_number) {
      return new Response(
        JSON.stringify({ success: false, error: "Your phone number is required. Please update your profile." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Initiating call:", { from: from_number, to: to_number, callerId: EXOTEL_CALLER_ID });

    const authString = btoa(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`);
    const subdomain = Deno.env.get("EXOTEL_SUBDOMAIN") || "api.exotel.com";
    const exotelUrl = `https://${subdomain}/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`;

    const callParams = new URLSearchParams({
      From: from_number,
      To: to_number,
      CallerId: EXOTEL_CALLER_ID,
      Record: "true",
      ...(custom_field && { CustomField: custom_field }),
    });

    // Get user from auth header for tracking
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseClient.auth.getUser();
      userId = user?.id || null;
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/exotel-webhook`;

    const response = await fetch(exotelUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: callParams.toString() + `&StatusCallback=${encodeURIComponent(webhookUrl)}&StatusCallbackContentType=application/json`,
    });

    const responseData = await response.json();
    console.log("Exotel API response:", response.status, JSON.stringify(responseData));

    const detectDND = (msg: string | undefined, code: string | number | undefined): boolean => {
      const m = (msg || "").toLowerCase();
      if (m.includes("dnd") || m.includes("do not disturb") || m.includes("ncpr") || m.includes("do-not-disturb")) {
        return true;
      }
      const codeStr = String(code || "");
      if (["11200", "11201", "11202", "11203"].includes(codeStr)) return true;
      return false;
    };

    if (!response.ok) {
      const exotelMsg = responseData?.RestException?.Message || "Failed to initiate call";
      const exotelCode = responseData?.RestException?.Code;
      const isDND = detectDND(exotelMsg, exotelCode);
      return new Response(
        JSON.stringify({ success: false, error: exotelMsg, dnd: isDND, details: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the call in database
    if (userId) {
      try {
        const callSid = responseData?.Call?.Sid || responseData?.Sid;
        if (callSid) {
          const { error: logError } = await supabase
            .from("call_logs")
            .insert({
              call_sid: callSid,
              demandcom_id: demandcom_id || null,
              initiated_by: userId,
              from_number: from_number,
              to_number: to_number,
              status: "initiated",
              direction: "outbound-api",
              call_method: "phone",
              edited_contact_info: edited_contact_info,
              disposition: disposition,
              subdisposition: subdisposition,
              notes: notes,
              exotel_response: responseData,
              start_time: new Date().toISOString(),
            });

          if (logError) console.error("Error logging call:", logError);

          if (next_call_date && demandcom_id) {
            await supabase
              .from("demandcom")
              .update({ next_call_date })
              .eq("id", demandcom_id);
          }
        }
      } catch (logError) {
        console.error("Error logging call:", logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Call initiated. You will receive a call at ${from_number}. Once you answer, you will be connected to ${to_number}.`,
        call: responseData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in exotel-make-call:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
