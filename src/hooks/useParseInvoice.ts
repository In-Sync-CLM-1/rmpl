import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ParsedInvoiceData {
  client_name: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  raw_amount_text: string | null;
}

interface ParseInvoiceResult {
  data: ParsedInvoiceData | null;
  error: string | null;
}

interface UseParseInvoiceResult {
  parseInvoice: (input: { pdfUrl?: string; bucket?: string; filePath?: string }) => Promise<ParseInvoiceResult>;
  isParsing: boolean;
  parseError: string | null;
}

export function useParseInvoice(): UseParseInvoiceResult {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseInvoice = async (input: { pdfUrl?: string; bucket?: string; filePath?: string }): Promise<ParseInvoiceResult> => {
    setIsParsing(true);
    setParseError(null);

    const fail = (message: string): ParseInvoiceResult => {
      setParseError(message);
      return { data: null, error: message };
    };

    try {
      const { data, error } = await supabase.functions.invoke("parse-invoice-pdf", {
        body: input,
      });

      if (error) {
        console.error("Parse invoice error:", error);

        let errorMessage = error.message || "Failed to parse invoice";
        if ("context" in error && error.context) {
          try {
            const body = await error.context.json();
            errorMessage = body?.error || body?.message || errorMessage;
          } catch {
            try {
              const text = await error.context.text?.();
              if (text) errorMessage = text;
            } catch {
              // Ignore secondary parsing errors and keep the original message.
            }
          }
        }

        return fail(errorMessage);
      }

      if (!data?.success) {
        return fail(data?.error || "Failed to extract invoice details");
      }

      setIsParsing(false);
      return { data: data.data as ParsedInvoiceData, error: null };
    } catch (err) {
      console.error("Parse invoice exception:", err);
      return fail(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsParsing(false);
    }
  };

  return { parseInvoice, isParsing, parseError };
}
