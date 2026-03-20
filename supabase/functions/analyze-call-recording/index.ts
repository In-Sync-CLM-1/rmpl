import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { callLogId } = await req.json();
    if (!callLogId) throw new Error("callLogId is required");

    // Fetch the call log
    const { data: callLog, error: fetchError } = await supabase
      .from("call_logs")
      .select("id, recording_url, to_number, from_number, conversation_duration, status, disposition, notes")
      .eq("id", callLogId)
      .single();

    if (fetchError || !callLog) throw new Error("Call log not found");
    if (!callLog.recording_url) throw new Error("No recording URL available for this call");

    console.log(`Analyzing call ${callLogId}, recording: ${callLog.recording_url}`);

    // Mark as processing
    await supabase
      .from("call_logs")
      .update({ call_analysis: { status: "processing" } })
      .eq("id", callLogId);

    // Step 1: Download the audio from the recording URL
    const audioResponse = await fetch(callLog.recording_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download recording: ${audioResponse.status}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log(`Downloaded audio: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

    // Step 2: Transcribe with ElevenLabs Scribe API
    const sttFormData = new FormData();
    const audioFile = new File([audioBlob], "recording.mp3", {
      type: audioBlob.type || "audio/mpeg",
    });
    sttFormData.append("file", audioFile);
    sttFormData.append("model_id", "scribe_v1");

    console.log("Sending to ElevenLabs for transcription...");

    const sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: sttFormData,
    });

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      throw new Error(`Transcription failed: ${sttResponse.status} - ${errText}`);
    }

    const sttResult = await sttResponse.json();
    const transcript = sttResult.text;

    if (!transcript || transcript.trim().length < 5) {
      // Save empty result
      await supabase
        .from("call_logs")
        .update({
          transcript: transcript || "",
          call_analysis: {
            status: "completed",
            error: "Transcript too short or empty - audio may be silent or inaudible",
          },
        })
        .eq("id", callLogId);

      return new Response(
        JSON.stringify({ success: true, transcript: "", analysis: null, message: "Transcript too short for analysis" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transcription complete: ${transcript.length} chars`);

    // Step 3: Analyze with Claude
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: `You are a call quality analyst for a B2B sales and marketing company. Analyze the call transcript and provide a comprehensive quality assessment. Be specific, actionable, and constructive in your feedback. Consider the Indian business context.`,
        tools: [
          {
            name: "call_quality_analysis",
            description: "Return structured call quality analysis",
            input_schema: {
              type: "object",
              properties: {
                overall_score: {
                  type: "number",
                  description: "Overall call quality score from 1-10",
                },
                sentiment: {
                  type: "string",
                  enum: ["positive", "neutral", "negative"],
                  description: "Overall sentiment of the call",
                },
                call_summary: {
                  type: "string",
                  description: "2-3 sentence summary of what happened in the call",
                },
                strengths: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-4 things the caller did well",
                },
                improvement_areas: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-4 specific, actionable suggestions for improvement",
                },
                key_topics: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-5 key topics discussed in the call",
                },
                customer_interest_level: {
                  type: "string",
                  enum: ["high", "medium", "low", "not_applicable"],
                  description: "How interested the customer seemed",
                },
                next_steps: {
                  type: "string",
                  description: "Recommended next steps based on the call outcome",
                },
              },
              required: [
                "overall_score",
                "sentiment",
                "call_summary",
                "strengths",
                "improvement_areas",
                "key_topics",
                "customer_interest_level",
                "next_steps",
              ],
            },
          },
        ],
        tool_choice: { type: "tool", name: "call_quality_analysis" },
        messages: [
          {
            role: "user",
            content: `Analyze this sales/business call transcript for quality, providing scores, strengths, improvement areas, and next steps.

Call details:
- Duration: ${callLog.conversation_duration || "unknown"} seconds
- Status: ${callLog.status}
${callLog.disposition ? `- Disposition: ${callLog.disposition}` : ""}
${callLog.notes ? `- Agent notes: ${callLog.notes}` : ""}

Transcript:
${transcript}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Claude API error:", errText);
      // Save transcript even if analysis fails
      await supabase
        .from("call_logs")
        .update({
          transcript,
          call_analysis: { status: "completed", error: "AI analysis failed" },
        })
        .eq("id", callLogId);

      return new Response(
        JSON.stringify({ success: true, transcript, analysis: null, message: "Transcript saved but AI analysis failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolUse = aiData.content?.find((c: any) => c.type === "tool_use");

    if (!toolUse) {
      throw new Error("No analysis returned from AI");
    }

    const analysis = {
      ...toolUse.input,
      status: "completed",
      analyzed_at: new Date().toISOString(),
    };

    // Step 4: Save results
    await supabase
      .from("call_logs")
      .update({ transcript, call_analysis: analysis })
      .eq("id", callLogId);

    console.log(`Analysis complete for call ${callLogId}: score=${analysis.overall_score}, sentiment=${analysis.sentiment}`);

    return new Response(
      JSON.stringify({ success: true, transcript, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-call-recording error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
