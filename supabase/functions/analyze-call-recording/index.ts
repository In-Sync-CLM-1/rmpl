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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
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

    const audioBuffer = await audioResponse.arrayBuffer();
    const uint8Array = new Uint8Array(audioBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const audioBase64 = btoa(binary);

    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";
    console.log(`Downloaded audio: ${audioBuffer.byteLength} bytes, type: ${contentType}`);

    // Step 2: Send audio directly to Claude for transcription + analysis
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20241022",
        max_tokens: 4096,
        system: `You are a call quality analyst for a B2B sales and marketing company. You will receive a call recording audio. First transcribe the conversation, then analyze the call quality. Be specific, actionable, and constructive. Consider the Indian business context. The call may be in Hindi, English, or a mix of both.`,
        tools: [
          {
            name: "call_quality_analysis",
            description: "Return structured call quality analysis with transcription",
            input_schema: {
              type: "object",
              properties: {
                transcript: {
                  type: "string",
                  description: "Full transcription of the call conversation",
                },
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
                "transcript",
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
            content: [
              {
                type: "text",
                text: `Listen to this sales/business call recording and provide a comprehensive quality analysis. First transcribe the conversation, then analyze it for quality, providing scores, strengths, improvement areas, and next steps.

Call details:
- Duration: ${callLog.conversation_duration || "unknown"} seconds
- Status: ${callLog.status}
${callLog.disposition ? `- Disposition: ${callLog.disposition}` : ""}
${callLog.notes ? `- Agent notes: ${callLog.notes}` : ""}`,
              },
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: contentType,
                  data: audioBase64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Claude API error:", aiResponse.status, errText);

      await supabase
        .from("call_logs")
        .update({
          call_analysis: { status: "completed", error: "AI analysis failed: " + aiResponse.status },
        })
        .eq("id", callLogId);

      return new Response(
        JSON.stringify({ success: false, error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolUse = aiData.content?.find((c: any) => c.type === "tool_use");

    if (!toolUse) {
      throw new Error("No analysis returned from AI");
    }

    const { transcript, ...analysisData } = toolUse.input;
    const analysis = {
      ...analysisData,
      status: "completed",
      analyzed_at: new Date().toISOString(),
    };

    // Save results
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
