import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ParsedPaymentData {
  amount?: number;
  payment_date?: string;
  reference_number?: string;
  bank_name?: string;
  payment_mode?: string;
}

export function useParsePaymentImage() {
  return useMutation({
    mutationFn: async (imageUrl: string): Promise<ParsedPaymentData> => {
      const { data, error } = await supabase.functions.invoke("parse-payment-image", {
        body: { imageUrl },
      });

      if (error) {
        console.error("Error parsing image:", error);
        throw new Error(error.message || "Failed to parse image");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to parse image");
      }

      return data.data as ParsedPaymentData;
    },
    onError: (error: Error) => {
      console.error("Parse payment image error:", error);
      toast.error(error.message || "Failed to parse payment image");
    },
  });
}
