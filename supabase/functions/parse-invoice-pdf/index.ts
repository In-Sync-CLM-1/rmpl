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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching PDF from URL:", pdfUrl);

    // Fetch the PDF directly and convert to base64
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      console.error("Failed to fetch PDF:", pdfResponse.status, await pdfResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to fetch PDF file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    // Convert to base64 in chunks to avoid stack overflow
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
2. **Invoice Amount**: The total invoice amount including taxes (in INR/Rupees if possible)
3. **Invoice Date**: The date the invoice was issued

Return the extracted data using the provided function. If a field cannot be determined, return null for that field.
Be careful to distinguish between the billing company (issuer) and the client (recipient).`;

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
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
              {
                type: "text",
                text: "Please extract the client name, invoice amount, and invoice date from this invoice.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_details",
              description: "Extract invoice details from the document",
              parameters: {
                type: "object",
                properties: {
                  client_name: {
                    type: "string",
                    description: "Name of the client/customer being billed",
                  },
                  invoice_amount: {
                    type: "number",
                    description: "Total invoice amount including taxes",
                  },
                  invoice_date: {
                    type: "string",
                    description: "Invoice date in YYYY-MM-DD format",
                  },
                },
                required: ["client_name", "invoice_amount", "invoice_date"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_details" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to parse invoice" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response");
      return new Response(
        JSON.stringify({ error: "Could not extract invoice details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log("Extracted invoice data:", extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          client_name: extractedData.client_name || null,
          invoice_amount: extractedData.invoice_amount || null,
          invoice_date: extractedData.invoice_date || null,
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
