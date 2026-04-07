import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDocument } from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import {
  groqStructuredResponse,
  GroqApiError,
} from "../_shared/groq.ts";
import { createServiceClient } from "../_shared/supabase-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractPdfText(pdfBuffer: ArrayBuffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => {
        if (typeof item === "object" && item !== null && "str" in item && typeof item.str === "string") {
          return item.str;
        }
        return "";
      })
      .join(" ")
      .trim();

    if (pageText) {
      pageTexts.push(`Page ${pageNumber}:\n${pageText}`);
    }
  }

  return pageTexts.join("\n\n");
}

async function loadPdfBuffer(options: {
  bucket?: string;
  filePath?: string;
  pdfUrl?: string;
}) {
  if (options.bucket && options.filePath) {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage
      .from(options.bucket)
      .download(options.filePath);

    if (error) {
      throw new Error(`Failed to download PDF from storage: ${error.message}`);
    }

    return await data.arrayBuffer();
  }

  if (options.pdfUrl) {
    const pdfResponse = await fetch(options.pdfUrl);
    if (!pdfResponse.ok) {
      const responseText = await pdfResponse.text().catch(() => "");
      throw new Error(`Failed to fetch PDF file (${pdfResponse.status})${responseText ? `: ${responseText}` : ""}`);
    }

    return await pdfResponse.arrayBuffer();
  }

  throw new Error("Either storage bucket/path or PDF URL is required");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl, bucket, filePath } = await req.json();

    if ((!bucket || !filePath) && !pdfUrl) {
      return new Response(
        JSON.stringify({ error: "Storage bucket/path or PDF URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Loading invoice PDF", { bucket, filePath, pdfUrlProvided: Boolean(pdfUrl) });

    let pdfBuffer: ArrayBuffer;
    try {
      pdfBuffer = await loadPdfBuffer({ bucket, filePath, pdfUrl });
    } catch (error) {
      console.error("Failed to load PDF:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Failed to load PDF file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extractedText: string;
    try {
      extractedText = await extractPdfText(pdfBuffer);
    } catch (error) {
      console.error("PDF text extraction failed:", error);
      return new Response(
        JSON.stringify({ error: "Could not read text from invoice PDF. If this is a scanned PDF, manual entry is required." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("PDF loaded and text extracted, size:", pdfBuffer.byteLength, "text chars:", extractedText.length);

    if (!extractedText.trim()) {
      return new Response(
        JSON.stringify({ error: "Could not extract readable text from invoice PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    let extractedData;
    try {
      extractedData = await groqStructuredResponse<{
        client_name: string | null;
        invoice_amount: number | null;
        invoice_date: string | null;
        raw_amount_text: string | null;
      }>({
        instructions: `${systemPrompt}\nUse only the extracted invoice text provided by the user. Return only JSON matching the schema.`,
        input: `Please extract the client name, invoice amount, and invoice date from this invoice text.\n\n${extractedText}`,
        schemaName: "extract_invoice_details",
        schema: {
          type: "object",
          properties: {
            client_name: { type: ["string", "null"] },
            invoice_amount: { type: ["number", "null"] },
            invoice_date: { type: ["string", "null"] },
            raw_amount_text: { type: ["string", "null"] },
          },
          required: ["client_name", "invoice_amount", "invoice_date", "raw_amount_text"],
        },
      });
    } catch (error) {
      if (error instanceof GroqApiError && error.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const status = error instanceof GroqApiError ? error.status : 500;
      const body = error instanceof GroqApiError ? error.body : String(error);
      console.error("Groq API error:", status, body);
      return new Response(
        JSON.stringify({ error: "Failed to parse invoice", details: body }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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
