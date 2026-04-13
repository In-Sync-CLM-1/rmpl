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

async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
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

async function parseWithAnthropic(pdfBuffer: ArrayBuffer): Promise<{
  client_name: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  raw_amount_text: string | null;
}> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const bytes = new Uint8Array(pdfBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  const base64Pdf = btoa(binary);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              type: "text",
              text: `Extract the following fields from this invoice and return ONLY a JSON object, no other text:
{
  "client_name": "<the client/customer being billed, not the issuer>",
  "invoice_amount": <grand total as a plain number no commas e.g. 1399244>,
  "invoice_date": "<date in YYYY-MM-DD format>",
  "raw_amount_text": "<grand total exactly as printed e.g. 13,99,244.00>"
}
Use null for any field you cannot find. Indian invoices use lakh notation (e.g. 13,99,244 = 1399244).`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim() || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Anthropic response");

  return JSON.parse(jsonMatch[0]);
}

async function loadPdfBuffer(options: {
  bucket?: string;
  filePath?: string;
  pdfUrl?: string;
}): Promise<ArrayBuffer> {
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

    console.log("PDF loaded, size:", pdfBuffer.byteLength);

    // Try pdfjs extraction first; fall back to Anthropic for signed/complex PDFs
    let pdfText = "";
    try {
      pdfText = await extractPdfText(pdfBuffer);
      console.log("pdfjs extracted text chars:", pdfText.length);
    } catch (err) {
      console.warn("pdfjs extraction failed, will use Anthropic:", err);
    }

    let extractedData: {
      client_name: string | null;
      invoice_amount: number | null;
      invoice_date: string | null;
      raw_amount_text: string | null;
    };

    if (pdfText.trim()) {
      // pdfjs worked — use Groq for structured extraction
      try {
        extractedData = await groqStructuredResponse<typeof extractedData>({
          instructions: `You are an invoice parsing AI. Extract:
1. client_name: The client/customer being billed (not the issuer)
2. invoice_amount: Grand total as a plain number in INR (no commas). Indian notation: 13,99,244 = 1399244
3. invoice_date: Invoice issue date
4. raw_amount_text: Exact amount string as printed (e.g. "13,99,244.00")
Return null for fields you cannot determine.`,
          input: `Extract invoice details from this text:\n\n${pdfText}`,
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
        console.warn("Groq failed, falling back to Anthropic:", error);
        extractedData = await parseWithAnthropic(pdfBuffer);
      }
    } else {
      // pdfjs returned no text (signed/complex PDF) — use Anthropic directly
      console.log("pdfjs returned no text, using Anthropic for PDF parsing");
      extractedData = await parseWithAnthropic(pdfBuffer);
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
