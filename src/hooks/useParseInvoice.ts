import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ParsedInvoiceData {
  client_name: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  raw_amount_text: string | null;
}

interface UseParseInvoiceResult {
  parseInvoice: (pdfUrl: string) => Promise<ParsedInvoiceData | null>;
  isParsing: boolean;
  parseError: string | null;
}

export function useParseInvoice(): UseParseInvoiceResult {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseInvoice = async (pdfUrl: string): Promise<ParsedInvoiceData | null> => {
    setIsParsing(true);
    setParseError(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-invoice-pdf", {
        body: { pdfUrl },
      });

      if (error) {
        console.error("Parse invoice error:", error);
        setParseError(error.message || "Failed to parse invoice");
        return null;
      }

      if (!data?.success) {
        setParseError(data?.error || "Failed to extract invoice details");
        return null;
      }

      return data.data as ParsedInvoiceData;
    } catch (err) {
      console.error("Parse invoice exception:", err);
      setParseError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsParsing(false);
    }
  };

  return { parseInvoice, isParsing, parseError };
}
