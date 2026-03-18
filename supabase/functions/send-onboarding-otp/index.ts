import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPhoneForExotel(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact, type } = await req.json();

    if (!contact || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing contact or type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type !== 'email' && type !== 'phone') {
      return new Response(
        JSON.stringify({ error: 'Type must be email or phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store OTP
    const { error: insertError } = await supabase
      .from('onboarding_otp_verifications')
      .insert({
        contact,
        otp_code: otp,
        type,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Failed to store OTP:', insertError);
      throw new Error('Failed to generate OTP');
    }

    // Send OTP via email
    if (type === 'email') {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY not configured');
      }

      const resend = new Resend(resendApiKey);
      const emailResponse = await resend.emails.send({
        from: 'RMPL Onboarding <approval@redefinemarcom.in>',
        to: [contact],
        subject: 'Your Onboarding Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1e3a5f; margin-bottom: 16px;">Email Verification</h2>
            <p style="color: #555; margin-bottom: 24px;">Use the code below to verify your email address for the onboarding form:</p>
            <div style="background: #f0f4f8; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${otp}</span>
            </div>
            <p style="color: #888; font-size: 13px;">This code expires in 10 minutes.</p>
          </div>
        `,
      });

      if (emailResponse.error) {
        console.error('Resend error:', emailResponse.error);
        throw new Error('Failed to send verification email');
      }
    } else {
      // Phone OTP via Exotel WhatsApp
      const exotelSid = Deno.env.get('EXOTEL_SID');
      const exotelApiKey = Deno.env.get('EXOTEL_API_KEY');
      const exotelApiToken = Deno.env.get('EXOTEL_API_TOKEN');
      const exotelCallerId = Deno.env.get('EXOTEL_CALLER_ID');

      if (!exotelSid || !exotelApiKey || !exotelApiToken || !exotelCallerId) {
        throw new Error('Exotel credentials not configured for WhatsApp OTP');
      }

      const phoneDigits = formatPhoneForExotel(contact);
      const sourceNumber = '918178798930';

      const exotelPayload = {
        whatsapp: {
          messages: [{
            from: sourceNumber,
            to: phoneDigits,
            content: {
              type: 'template',
              template: {
                name: 'otp',
                language: { code: 'en' },
                components: [{
                  type: 'body',
                  parameters: [{
                    type: 'text',
                    text: otp
                  }]
                }]
              }
            }
          }]
        }
      };

      const exotelUrl = `https://api.exotel.com/v2/accounts/${exotelSid}/messages`;

      console.log('Sending WhatsApp OTP payload:', JSON.stringify(exotelPayload));

      const exotelResponse = await fetch(exotelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`,
        },
        body: JSON.stringify(exotelPayload),
      });

      const responseText = await exotelResponse.text();
      console.log('Exotel WhatsApp OTP response status:', exotelResponse.status, 'body:', responseText);

      if (!exotelResponse.ok) {
        console.error('Exotel API error:', exotelResponse.status, responseText);
        throw new Error('Failed to send WhatsApp OTP');
      }

      if (!responseText || responseText.trim() === '') {
        console.error('Exotel returned empty response body - message likely not queued');
        throw new Error('WhatsApp OTP delivery failed: empty response from provider');
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `OTP sent to ${type}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('send-onboarding-otp error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send OTP' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
