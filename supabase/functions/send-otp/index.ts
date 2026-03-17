import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    // Validate: must be 10-digit Indian mobile
    const clean = (phone || "").replace(/\D/g, "");
    if (clean.length !== 10 || !/^[6-9]/.test(clean)) {
      return new Response(
        JSON.stringify({ error: "Invalid mobile number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalized = `+91${clean}`;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit: max 5 OTPs per phone per hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("public_otp_verifications")
      .select("*", { count: "exact", head: true })
      .eq("identifier", normalized)
      .gte("created_at", oneHourAgo);

    if ((count || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate & store OTP
    const otpCode = generateOtp();
    const { data: otpRecord, error: insertError } = await supabase
      .from("public_otp_verifications")
      .insert({
        identifier: normalized,
        identifier_type: "phone",
        otp_code: otpCode,
      })
      .select("session_id")
      .single();

    if (insertError) {
      console.error("OTP insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load Exotel config from DB
    const { data: config } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!config?.exotel_sid) {
      // Test mode fallback when WhatsApp not configured
      return new Response(
        JSON.stringify({
          success: true,
          sessionId: otpRecord.session_id,
          isTestMode: true,
          testOtp: otpCode,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send WhatsApp message via Exotel API (matching send-whatsapp-message pattern)
    const toPhone = normalized.replace(/^\+/, "");

    const payload = {
      whatsapp: {
        messages: [
          {
            from: config.whatsapp_source_number,
            to: toPhone,
            content: {
              type: "template",
              template: {
                name: "otp",
                language: { code: "en" },
                components: [
                  {
                    type: "body",
                    parameters: [{ type: "text", text: otpCode }],
                  },
                ],
              },
            },
          },
        ],
      },
    };

    const subdomain = config.exotel_subdomain || "api.exotel.com";
    const url = `https://${subdomain}/v2/accounts/${config.exotel_sid}/messages`;

    console.log(`Sending OTP to ${toPhone} from ${config.whatsapp_source_number} via ${subdomain}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${config.exotel_api_key}:${config.exotel_api_token}`)}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log(`Exotel response status: ${res.status}, body: ${responseText}`);

    if (!res.ok) {
      console.error("Exotel error:", responseText);
      return new Response(
        JSON.stringify({ error: "Failed to send WhatsApp message", details: responseText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: otpRecord.session_id,
        message: "OTP sent to your WhatsApp",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
