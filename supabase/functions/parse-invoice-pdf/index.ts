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
    const { pdfUrl } = await req.json();

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "PDF URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching PDF from URL:", pdfUrl);

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      console.error("Failed to fetch PDF:", pdfResponse.status, await pdfResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to fetch PDF file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const pdfBase64 = btoa(binary);
    console.log("PDF fetched and converted to base64, size:", pdfBuffer.byteLength);

    const systemPrompt = `You are an invoice parsing AI. Analyze the provided invoice PDF and extract the following information:

1. **Client Name**: The name of the client/customer being billed (not the company issuing the invoice)
2. **Invoice Amount**: The grand total / final invoice amount including taxes, as a plain number in INR (Rupees).
   CRITICAL: Indian invoices use the Indian numbering system where commas are placed as: XX,XX,XXX (lakhs, thousands, hundreds).
   For example: "47,36,811.00" means 47 lakhs 36 thousand 811 = 4736811 (NOT 47360811).
   "1,91,632.00" means 1 lakh 91 thousand 632 = 191632.
   "25,00,000.00" means 25 lakhs = 2500000.
   Always return the amount as a plain integer/decimal number with NO commas. Double-check your conversion.
3. **Invoice Date**: The date the invoice was issued

Return the extracted data using the provided function. If a field cannot be determined, return null for that field.
Be careful to distinguish between the billing company (issuer) and the client (recipient).
Also return the raw_amount_text field — the exact amount string as printed on the invoice (e.g. "47,36,811.00") for verification.`;

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
            name: "extract_invoice_details",
            description: "Extract invoice details from the document",
            input_schema: {
              type: "object",
              properties: {
                client_name: { type: "string", description: "Name of the client/customer being billed" },
                invoice_amount: { type: "number", description: "Total/grand total invoice amount as a plain number in INR. Convert Indian format (e.g. 47,36,811 = 4736811) correctly." },
                invoice_date: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
                raw_amount_text: { type: "string", description: "The exact amount string as printed on the invoice, e.g. '47,36,811.00'" },
              },
              required: ["client_name", "invoice_amount", "invoice_date"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "extract_invoice_details" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: "Please extract the client name, invoice amount, and invoice date from this invoice.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to parse invoice" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const toolUse = data.content?.find((c: any) => c.type === 'tool_use');
    if (!toolUse) {
      console.error("No tool use in response");
      return new Response(
        JSON.stringify({ error: "Could not extract invoice details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedData = toolUse.input;
    console.log("Extracted invoice data:", extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          client_name: extractedData.client_name || null,
          invoice_amount: extractedData.invoice_amount || null,
          invoice_date: extractedData.invoice_date || null,
          raw_amount_text: extractedData.raw_amount_text || null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing invoice:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
