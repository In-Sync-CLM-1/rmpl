import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Exotel webhook received');

    // Parse webhook payload (Exotel can send application/x-www-form-urlencoded or JSON)
    const contentType = req.headers.get('content-type') || '';
    let payload: any = {};
    
    if (contentType.includes('application/json')) {
      payload = await req.json();
      console.log('JSON payload:', payload);
    } else {
      // Parse form data
      const formData = await req.formData();
      payload = Object.fromEntries(formData);
      console.log('Form data payload:', payload);
    }

    // Extract call details from Exotel webhook
    // Exotel may use different field names, handle both cases
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
    const status = (Status || CallStatus || 'unknown').toLowerCase();
    const duration = parseInt(ConversationDuration || Duration || '0', 10);

    if (!callSid) {
      console.error('No CallSid found in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing CallSid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating call log for SID: ${callSid}, Status: ${status}, Duration: ${duration}`);

    // Update call log in database using service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build update object
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString(),
    };

    if (duration > 0) {
      updateData.conversation_duration = duration;
    }
    if (RecordingUrl) {
      updateData.recording_url = RecordingUrl;
    }
    if (EndTime) {
      updateData.end_time = EndTime;
    }
    if (StartTime && !updateData.start_time) {
      updateData.start_time = StartTime;
    }

    console.log('Update data:', updateData);

    const { data, error } = await supabase
      .from('call_logs')
      .update(updateData)
      .eq('call_sid', callSid)
      .select();

    if (error) {
      console.error('Error updating call log:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update call log', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Call log updated successfully:', data);

    return new Response(
      JSON.stringify({ success: true, updated: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
