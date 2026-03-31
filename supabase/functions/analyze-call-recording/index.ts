import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured. Get a free key from console.groq.com and add it as a Supabase secret.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { callLogId } = await req.json();
    if (!callLogId) throw new Error("callLogId is required");

    // Fetch the call log
    const { data: callLog, error: fetchError } = await supabase
      .from("call_logs")
      .select("id, recording_url, storage_recording_url, to_number, from_number, conversation_duration, status, disposition, notes")
      .eq("id", callLogId)
      .single();

    if (fetchError || !callLog) throw new Error("Call log not found");

    const recordingUrl = callLog.storage_recording_url || callLog.recording_url;
    if (!recordingUrl) throw new Error("No recording URL available for this call");

    console.log(`Analyzing call ${callLogId}, recording: ${recordingUrl}`);

    // Mark as processing
    await supabase
      .from("call_logs")
      .update({ call_analysis: { status: "processing" } })
      .eq("id", callLogId);

    // Step 1: Download the audio
    const fetchHeaders: Record<string, string> = {};
    if (!callLog.storage_recording_url && callLog.recording_url) {
      const { data: settings } = await supabase
        .from("whatsapp_settings")
        .select("exotel_api_key, exotel_api_token")
        .limit(1)
        .single();
      const apiKey = settings?.exotel_api_key || Deno.env.get("EXOTEL_API_KEY");
      const apiToken = settings?.exotel_api_token || Deno.env.get("EXOTEL_API_TOKEN");
      if (apiKey && apiToken) {
        fetchHeaders["Authorization"] = `Basic ${btoa(`${apiKey}:${apiToken}`)}`;
      }
    }

    const audioResponse = await fetch(recordingUrl, { headers: fetchHeaders });
    if (!audioResponse.ok) {
      throw new Error(`Failed to download recording: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";
    console.log(`Downloaded audio: ${audioBuffer.byteLength} bytes, type: ${contentType}`);

    // Step 2: Transcribe audio using Groq Whisper (free, fast)
    console.log("Transcribing with Groq Whisper...");
    const extension = contentType.includes("wav") ? "wav" : "mp3";
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: contentType }), `recording.${extension}`);
    formData.append("model", "whisper-large-v3");
    formData.append("language", "hi"); // Hindi + English mix — Whisper handles code-switching well
    formData.append("response_format", "text");

    const whisperResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text();
      console.error("Groq Whisper error:", whisperResponse.status, errText);
      throw new Error(`Transcription failed (${whisperResponse.status}): ${errText.substring(0, 200)}`);
    }

    const transcript = await whisperResponse.text();
    console.log(`Transcription complete: ${transcript.length} chars`);

    if (!transcript || transcript.trim().length === 0) {
      // No speech detected — save and return
      const analysis = {
        status: "completed",
        analyzed_at: new Date().toISOString(),
        overall_score: 0,
        sentiment: "neutral",
        call_summary: "No speech detected in the recording.",
        strengths: [],
        improvement_areas: [],
        key_topics: [],
        customer_interest_level: "not_applicable",
        next_steps: "Verify the recording is valid.",
      };
      await supabase
        .from("call_logs")
        .update({ transcript: "(no speech detected)", call_analysis: analysis })
        .eq("id", callLogId);

      return new Response(
        JSON.stringify({ success: true, transcript: "(no speech detected)", analysis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Analyze transcript with Haiku
    console.log("Analyzing transcript with Haiku...");
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: `You are a call quality analyst for a B2B sales and marketing company called Redefine Marcom. Analyze the provided call transcript for quality, sentiment, and actionable insights. Be specific, actionable, and constructive. Consider the Indian business context. The transcript may be in Hindi, English, or a mix of both — respond in English.`,
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
            content: `Analyze this sales/business call transcript for quality. Provide scores, strengths, improvement areas, and next steps.

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
      console.error("Claude API error:", aiResponse.status, errText);

      // Save transcript even if analysis fails
      await supabase
        .from("call_logs")
        .update({
          transcript,
          call_analysis: { status: "completed", error: `AI analysis failed (${aiResponse.status}): ${errText.substring(0, 200)}` },
        })
        .eq("id", callLogId);

      return new Response(
        JSON.stringify({ success: false, error: `AI analysis failed (${aiResponse.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolUse = aiData.content?.find((c: any) => c.type === "tool_use");

    if (!toolUse) {
      // Save transcript even if structured analysis not returned
      await supabase
        .from("call_logs")
        .update({ transcript, call_analysis: { status: "completed", error: "No structured analysis returned" } })
        .eq("id", callLogId);
      throw new Error("No analysis returned from AI");
    }

    const analysis = {
      ...toolUse.input,
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
