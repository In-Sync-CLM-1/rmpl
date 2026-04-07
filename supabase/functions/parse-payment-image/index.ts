import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  groqStructuredResponse,
  GROQ_VISION_MODEL,
  GroqApiError,
} from "../_shared/groq.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Parsing payment image:", imageUrl);

    const systemPrompt = `You are an expert at extracting payment information from images. You analyze payment confirmation screenshots, bank transfer receipts, UPI payment confirmations, cheque images, and similar payment proof documents.

Extract the following information and return it in a structured format:
- amount: The payment amount as a number (without currency symbols)
- payment_date: The payment date in YYYY-MM-DD format
- reference_number: Transaction ID, UTR number, or reference number
- bank_name: The bank or payment app name (e.g., HDFC Bank, Google Pay, PhonePe)
- payment_mode: One of: upi, bank_transfer, neft, rtgs, imps, cheque, cash, card

If you cannot find a specific field, set it to null. Be precise and extract only what is clearly visible in the image.`;

    let parsedData;
    try {
      parsedData = await groqStructuredResponse<{
        amount: number | null;
        payment_date: string | null;
        reference_number: string | null;
        bank_name: string | null;
        payment_mode: "upi" | "bank_transfer" | "neft" | "rtgs" | "imps" | "cheque" | "cash" | "card" | null;
      }>({
        instructions: `${systemPrompt}\nReturn only JSON matching the schema.`,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Please analyze this payment confirmation image and extract the payment details.",
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "auto",
              },
            ],
          },
        ],
        schemaName: "extract_payment_details",
        schema: {
          type: "object",
          properties: {
            amount: { type: ["number", "null"] },
            payment_date: { type: ["string", "null"] },
            reference_number: { type: ["string", "null"] },
            bank_name: { type: ["string", "null"] },
            payment_mode: {
              type: ["string", "null"],
              enum: ["upi", "bank_transfer", "neft", "rtgs", "imps", "cheque", "cash", "card", null],
            },
          },
          required: ["amount", "payment_date", "reference_number", "bank_name", "payment_mode"],
        },
        model: GROQ_VISION_MODEL,
      });
    } catch (error) {
      if (error instanceof GroqApiError && error.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const status = error instanceof GroqApiError ? error.status : 500;
      const body = error instanceof GroqApiError ? error.body : String(error);
      console.error("Groq API error:", status, body);
      throw new Error(`Groq API error: ${status}`);
    }
    console.log("Parsed payment data:", parsedData);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing payment image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to parse image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
