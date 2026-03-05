import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("📷 Parsing payment image:", imageUrl);

    const systemPrompt = `You are an expert at extracting payment information from images. You analyze payment confirmation screenshots, bank transfer receipts, UPI payment confirmations, cheque images, and similar payment proof documents.

Extract the following information and return it in a structured format:
- amount: The payment amount as a number (without currency symbols)
- payment_date: The payment date in YYYY-MM-DD format
- reference_number: Transaction ID, UTR number, or reference number
- bank_name: The bank or payment app name (e.g., HDFC Bank, Google Pay, PhonePe)
- payment_mode: One of: upi, bank_transfer, neft, rtgs, imps, cheque, cash, card

If you cannot find a specific field, set it to null. Be precise and extract only what is clearly visible in the image.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this payment confirmation image and extract the payment details."
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_payment_details",
              description: "Extract payment details from the image",
              parameters: {
                type: "object",
                properties: {
                  amount: {
                    type: "number",
                    description: "Payment amount as a number"
                  },
                  payment_date: {
                    type: "string",
                    description: "Payment date in YYYY-MM-DD format"
                  },
                  reference_number: {
                    type: "string",
                    description: "Transaction ID, UTR, or reference number"
                  },
                  bank_name: {
                    type: "string",
                    description: "Bank or payment app name"
                  },
                  payment_mode: {
                    type: "string",
                    enum: ["upi", "bank_transfer", "neft", "rtgs", "imps", "cheque", "cash", "card"],
                    description: "Payment mode"
                  }
                },
                required: ["amount"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_payment_details" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("🤖 AI Response:", JSON.stringify(data));

    // Extract the function call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call response from AI");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log("✅ Parsed payment data:", parsedData);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error parsing payment image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to parse image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
