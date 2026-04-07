import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  groqStructuredResponse,
  GroqApiError,
} from "../_shared/groq.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    const { message } = payload;

    if (!message) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageType = message.type;
    const callId = message.call?.id;

    if (!callId) {
      console.log("No call ID in webhook payload, skipping");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`VAPI webhook: type=${messageType}, callId=${callId}`);

    switch (messageType) {
      case "status-update": {
        const status = message.status;
        const updateData: Record<string, unknown> = { status };

        if (status === "in-progress") {
          updateData.started_at = new Date().toISOString();
        }

        await supabase
          .from("vapi_call_logs")
          .update(updateData)
          .eq("vapi_call_id", callId);
        break;
      }

      case "end-of-call-report": {
        const updateData: Record<string, unknown> = {
          status: "ended",
          ended_at: message.endedAt || new Date().toISOString(),
          duration_seconds: message.durationSeconds || null,
          transcript: message.transcript || null,
          call_summary: message.summary || null,
        };

        if (message.startedAt) {
          updateData.started_at = message.startedAt;
        }

        await supabase
          .from("vapi_call_logs")
          .update(updateData)
          .eq("vapi_call_id", callId);

        // AI Sentiment Analysis via Groq
        const transcript = message.transcript;
        if (transcript && typeof transcript === "string" && transcript.length > 10) {
          try {
            const analysis = await groqStructuredResponse<{
              sentiment: "positive" | "neutral" | "negative";
              sentiment_score: number;
              response_summary: string;
              key_topics: string[];
            }>({
              instructions: "You are a call analysis assistant. Analyze the call transcript and return only JSON matching the schema.",
              input: `Analyze this call transcript and return a structured analysis with sentiment, sentiment_score (0.0-1.0), response_summary (2-3 sentences), and key_topics (3-5 topics).

Transcript:
${transcript}`,
              schemaName: "analyze_call",
              schema: {
                type: "object",
                properties: {
                  sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                  sentiment_score: { type: "number" },
                  response_summary: { type: "string" },
                  key_topics: { type: "array", items: { type: "string" } },
                },
                required: ["sentiment", "sentiment_score", "response_summary", "key_topics"],
              },
            });

            await supabase
              .from("vapi_call_logs")
              .update({
                sentiment: analysis.sentiment,
                sentiment_score: analysis.sentiment_score,
                response_summary: analysis.response_summary,
                key_topics: analysis.key_topics,
              })
              .eq("vapi_call_id", callId);
            console.log(`AI analysis saved for call ${callId}: ${analysis.sentiment}`);
          } catch (aiErr) {
            if (aiErr instanceof GroqApiError) {
              console.error("Groq API error:", aiErr.status, aiErr.body);
            }
            console.error("AI sentiment analysis failed:", aiErr);
          }
        }
        break;
      }

      case "hang": {
        await supabase
          .from("vapi_call_logs")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
          })
          .eq("vapi_call_id", callId);
        break;
      }

      default:
        console.log(`Unhandled VAPI webhook type: ${messageType}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("vapi-webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
