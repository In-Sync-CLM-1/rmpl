import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlivoWebhookPayload {
  From: string;
  To: string;
  Text: string;
  Type: string;
  MessageUUID: string;
}

const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'QUIT', 'CANCEL', 'END', 'OPTOUT'];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📨 Received inbound SMS webhook from Plivo');

    // Parse Plivo webhook payload
    const payload: PlivoWebhookPayload = await req.json();
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const { From, To, Text, MessageUUID } = payload;

    if (!From || !To || !Text) {
      console.error('❌ Missing required fields in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalize phone number (remove +1 or other country codes for matching)
    const normalizedFrom = From.replace(/^\+?1?/, '').replace(/\D/g, '');
    console.log('🔍 Looking up DemandCom record with phone:', normalizedFrom);

    // Look up DemandCom by phone number
    const { data: demandComRecords, error: demandComError } = await supabase
      .from('demandcom')
      .select('id, first_name, last_name, phone, email')
      .or(`phone.eq.${From},phone.eq.${normalizedFrom},phone.ilike.%${normalizedFrom}%`)
      .limit(1);

    if (demandComError) {
      console.error('❌ Error looking up DemandCom:', demandComError);
      throw demandComError;
    }

    const demandCom = demandComRecords?.[0];
    console.log(demandCom ? `✅ Found DemandCom: ${demandCom.first_name} ${demandCom.last_name}` : '⚠️ No DemandCom found');

    // Find the most recent campaign sent to this DemandCom
    let campaignId = null;
    if (demandCom) {
      const { data: recentCampaign } = await supabase
        .from('campaign_recipients')
        .select('campaign_id')
        .eq('demandcom_id', demandCom.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      campaignId = recentCampaign?.campaign_id || null;
      if (campaignId) {
        console.log('📧 Linked to campaign:', campaignId);
      }
    }

    // Check for opt-out keywords
    const isOptOut = OPT_OUT_KEYWORDS.some(keyword => 
      Text.toUpperCase().trim() === keyword
    );
    console.log(isOptOut ? '🚫 Opt-out keyword detected' : '💬 Regular message');

    // Store the inbound SMS
    const { error: insertError } = await supabase
      .from('inbound_sms')
      .insert({
        from_number: From,
        to_number: To,
        message_text: Text,
        message_uuid: MessageUUID,
        campaign_id: campaignId,
        demandcom_id: demandCom?.id || null,
        is_opt_opt: isOptOut,
        received_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ Error storing inbound SMS:', insertError);
      throw insertError;
    }

    console.log('✅ Inbound SMS stored successfully');

    // If opt-out keyword detected and DemandCom exists, mark as unsubscribed
    if (isOptOut && demandCom) {
      const { error: updateError } = await supabase
        .from('demandcom')
        .update({ is_unsubscribed: true })
        .eq('id', demandCom.id);

      if (updateError) {
        console.error('❌ Error updating DemandCom unsubscribe status:', updateError);
        throw updateError;
      }

      console.log('✅ DemandCom marked as unsubscribed');

      // Optional: Send auto-response confirmation
      try {
        const plivoAuthId = Deno.env.get('PLIVO_AUTH_ID');
        const plivoAuthToken = Deno.env.get('PLIVO_AUTH_TOKEN');
        const plivoPhoneNumber = Deno.env.get('PLIVO_PHONE_NUMBER');

        if (plivoAuthId && plivoAuthToken && plivoPhoneNumber) {
          const auth = btoa(`${plivoAuthId}:${plivoAuthToken}`);
          
          const response = await fetch(
            `https://api.plivo.com/v1/Account/${plivoAuthId}/Message/`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                src: plivoPhoneNumber,
                dst: From,
                text: "You've been unsubscribed from our SMS list. Reply START to resubscribe.",
              }),
            }
          );

          if (response.ok) {
            console.log('✅ Opt-out confirmation sent');
          } else {
            console.error('⚠️ Failed to send opt-out confirmation:', await response.text());
          }
        }
      } catch (autoResponseError) {
        console.error('⚠️ Error sending auto-response:', autoResponseError);
        // Don't throw - auto-response is optional
      }
    }

    // Return 200 OK to Plivo
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Inbound SMS processed successfully',
        isOptOut,
        demandComFound: !!demandCom,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error processing inbound SMS:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
