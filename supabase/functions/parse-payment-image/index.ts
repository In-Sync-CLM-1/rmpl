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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        tools: [
          {
            name: "extract_payment_details",
            description: "Extract payment details from the image",
            input_schema: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Payment amount as a number" },
                payment_date: { type: "string", description: "Payment date in YYYY-MM-DD format" },
                reference_number: { type: "string", description: "Transaction ID, UTR, or reference number" },
                bank_name: { type: "string", description: "Bank or payment app name" },
                payment_mode: { type: "string", enum: ["upi", "bank_transfer", "neft", "rtgs", "imps", "cheque", "cash", "card"], description: "Payment mode" }
              },
              required: ["amount"],
            }
          }
        ],
        tool_choice: { type: "tool", name: "extract_payment_details" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this payment confirmation image and extract the payment details."
              },
              {
                type: "image",
                source: { type: "url", url: imageUrl }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI Response:", JSON.stringify(data));

    const toolUse = data.content?.find((c: any) => c.type === 'tool_use');
    if (!toolUse) {
      throw new Error("No tool use response from AI");
    }

    const parsedData = toolUse.input;
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
