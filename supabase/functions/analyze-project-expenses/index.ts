import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDocument } from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import { createServiceClient } from "../_shared/supabase-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getAnthropicKey() {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return key;
}

async function extractPdfText(pdfUrl: string): Promise<string> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .trim();
    if (text) pages.push(text);
  }
  return pages.join("\n\n");
}

async function fetchFileAsText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  // For CSV/text files
  if (contentType.includes("text") || url.toLowerCase().endsWith(".csv")) {
    return await res.text();
  }
  // For Excel files - return as base64 and note it's binary
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Try to read as text (works for CSV even with xlsx extension sometimes)
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return `[Binary Excel file - ${bytes.length} bytes - parse from filename: ${url.split("/").pop()}]`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submissionId, excelUrl, invoiceUrls, category } = await req.json();

    // Fetch submission record to get discount and loyalty data
    let vendorDiscounts: any[] = [];
    let loyaltyPoints: any[] = [];
    if (submissionId) {
      const supabaseClient = createServiceClient();
      const { data: submissionRecord } = await supabaseClient
        .from("project_expense_submissions")
        .select("vendor_discounts, loyalty_points, discounts_received, points_received")
        .eq("id", submissionId)
        .single();
      if (submissionRecord) {
        vendorDiscounts = submissionRecord.vendor_discounts || [];
        loyaltyPoints = submissionRecord.loyalty_points || [];
      }
    }

    let excelContent = "";
    if (excelUrl) {
      try {
        excelContent = await fetchFileAsText(excelUrl);
      } catch (e) {
        excelContent = `[Could not read Excel file: ${e.message}]`;
      }
    }

    const invoiceTexts: string[] = [];
    for (const inv of (invoiceUrls || [])) {
      const url = typeof inv === "string" ? inv : inv.url;
      const name = typeof inv === "string" ? url.split("/").pop() : inv.name;
      try {
        if (url.toLowerCase().endsWith(".pdf")) {
          const text = await extractPdfText(url);
          invoiceTexts.push(`--- Invoice: ${name} ---\n${text}`);
        } else {
          invoiceTexts.push(`--- Invoice: ${name} ---\n[Image file - visual invoice]`);
        }
      } catch (e) {
        invoiceTexts.push(`--- Invoice: ${name} ---\n[Could not read: ${e.message}]`);
      }
    }

    const combinedContent = [
      excelContent ? `=== EXPENSE SUMMARY SHEET ===\n${excelContent}` : "",
      invoiceTexts.length > 0 ? `=== VENDOR INVOICES ===\n${invoiceTexts.join("\n\n")}` : "",
    ].filter(Boolean).join("\n\n");

    const benefitsContext = [
      vendorDiscounts.length > 0
        ? `If vendor discounts were received: ${JSON.stringify(vendorDiscounts)}`
        : "",
      loyaltyPoints.length > 0
        ? `If loyalty points were earned: ${JSON.stringify(loyaltyPoints)}`
        : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are a financial analyst for an events/marketing company in India.
Analyze expense documents and produce a structured category-wise expense summary.
The primary expense category context is: "${category}".
All amounts are in INR. Use the Indian numbering system where relevant.
Extract every line item you can find and group them by expense type.
Common categories: Venue & Infrastructure, Food & Beverage, Travel & Accommodation, Audio Visual & Tech, Creative & Printing, Staffing & Labour, Gifting & Merchandise, Miscellaneous.
${benefitsContext ? `\n${benefitsContext}\nInclude a "Benefits & Savings" section in your analysis that calls out discounts received and loyalty points earned.` : ""}
Return ONLY valid JSON matching the exact schema provided.`;

    const userMessage = `Please analyze these expense documents and return a structured expense summary:\n\n${combinedContent || "No document content could be extracted."}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": getAnthropicKey(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        tools: [{
          name: "expense_summary",
          description: "Structured expense summary with category-wise breakdown",
          input_schema: {
            type: "object",
            properties: {
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          description: { type: "string" },
                          vendor: { type: "string" },
                          amount: { type: "number" },
                        },
                        required: ["description", "amount"],
                      },
                    },
                    subtotal: { type: "number" },
                  },
                  required: ["name", "items", "subtotal"],
                },
              },
              grand_total: { type: "number" },
              narrative: { type: "string" },
              currency: { type: "string" },
              benefits: {
                type: "object",
                properties: {
                  total_discounts_inr: { type: "number" },
                  total_points_value_inr: { type: "number" },
                  discount_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        vendor: { type: "string" },
                        amount: { type: "number" },
                        notes: { type: "string" },
                      },
                      required: ["vendor", "amount"],
                    },
                  },
                  points_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        provider: { type: "string" },
                        points: { type: "number" },
                        est_value_inr: { type: "number" },
                      },
                      required: ["provider", "points"],
                    },
                  },
                },
                required: ["total_discounts_inr", "total_points_value_inr", "discount_items", "points_items"],
              },
            },
            required: ["categories", "grand_total", "narrative", "currency", "benefits"],
          },
        }],
        tool_choice: { type: "tool", name: "expense_summary" },
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json();
    const toolUse = anthropicData.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse) throw new Error("No structured output from Claude");

    const summary = toolUse.input;

    // Persist to DB
    if (submissionId) {
      const supabase = createServiceClient();
      await supabase
        .from("project_expense_submissions")
        .update({ ai_summary: summary, total_amount: summary.grand_total })
        .eq("id", submissionId);
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
