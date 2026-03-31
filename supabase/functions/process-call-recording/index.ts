import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { callLogId } = await req.json();
    if (!callLogId) throw new Error("callLogId is required");

    // Fetch call log
    const { data: callLog, error: fetchError } = await supabase
      .from("call_logs")
      .select("id, call_sid, recording_url, storage_recording_url, conversation_duration, status, disposition, notes, to_number, from_number")
      .eq("id", callLogId)
      .single();

    if (fetchError || !callLog) throw new Error("Call log not found");
    if (!callLog.recording_url) throw new Error("No recording URL available");

    // Skip if already processed
    if (callLog.storage_recording_url) {
      console.log(`Call ${callLogId} already has storage recording, skipping download`);
      return new Response(
        JSON.stringify({ success: true, alreadyProcessed: true, url: callLog.storage_recording_url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing call recording: ${callLogId}`);

    // Get Exotel credentials from whatsapp_settings or env
    const { data: settings } = await supabase
      .from("whatsapp_settings")
      .select("exotel_api_key, exotel_api_token")
      .limit(1)
      .single();

    const apiKey = settings?.exotel_api_key || Deno.env.get("EXOTEL_API_KEY");
    const apiToken = settings?.exotel_api_token || Deno.env.get("EXOTEL_API_TOKEN");

    // Download recording from Exotel (with auth if credentials available)
    const fetchHeaders: Record<string, string> = {};
    if (apiKey && apiToken) {
      fetchHeaders["Authorization"] = `Basic ${btoa(`${apiKey}:${apiToken}`)}`;
    }

    console.log(`Downloading recording from: ${callLog.recording_url}`);
    const audioResponse = await fetch(callLog.recording_url, { headers: fetchHeaders });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download recording: ${audioResponse.status} ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";
    const extension = contentType.includes("wav") ? "wav" : "mp3";

    console.log(`Downloaded: ${audioBuffer.byteLength} bytes, type: ${contentType}`);

    // Upload to Supabase Storage
    const storagePath = `${callLog.call_sid}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(storagePath, audioBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("call-recordings")
      .getPublicUrl(storagePath);

    const storageUrl = urlData.publicUrl;
    console.log(`Uploaded to storage: ${storageUrl}`);

    // Update call log with storage URL
    await supabase
      .from("call_logs")
      .update({ storage_recording_url: storageUrl })
      .eq("id", callLogId);

    // Auto-trigger AI analysis if not already done
    if (!callLog.disposition || callLog.conversation_duration > 0) {
      console.log(`Triggering AI analysis for call ${callLogId}`);
      try {
        await fetch(`${supabaseUrl}/functions/v1/analyze-call-recording`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ callLogId }),
        });
        console.log("AI analysis triggered successfully");
      } catch (analysisError) {
        console.error("Failed to trigger AI analysis:", analysisError);
        // Non-fatal - recording is still saved
      }
    }

    return new Response(
      JSON.stringify({ success: true, storageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-call-recording error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
