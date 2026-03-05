import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface QuotationPayment {
  id: string;
  quotation_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number: string | null;
  bank_name: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  profiles?: { full_name: string | null };
  payment_proof_images?: PaymentProofImage[];
}

export interface PaymentProofImage {
  id: string;
  payment_id: string;
  image_url: string;
  parsed_data: any;
  parse_status: string;
  parse_error: string | null;
  created_at: string;
}

export interface CreatePaymentData {
  quotation_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number?: string;
  bank_name?: string;
  notes?: string;
}

export function useQuotationPayments(quotationId: string) {
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["quotation-payments", quotationId],
    staleTime: 2 * 60 * 1000, // 2 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotation_payments")
        .select(`
          *,
          profiles:recorded_by(full_name),
          payment_proof_images(*)
        `)
        .eq("quotation_id", quotationId)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data as QuotationPayment[];
    },
    enabled: !!quotationId,
  });

  const createPayment = useMutation({
    mutationFn: async (paymentData: CreatePaymentData) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quotation_payments")
        .insert({
          ...paymentData,
          recorded_by: user.data.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-payments", quotationId] });
      queryClient.invalidateQueries({ queryKey: ["project-quotations"] });
      toast.success("Payment recorded successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating payment:", error);
      toast.error(error.message || "Failed to record payment");
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("quotation_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-payments", quotationId] });
      queryClient.invalidateQueries({ queryKey: ["project-quotations"] });
      toast.success("Payment deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting payment:", error);
      toast.error("Failed to delete payment");
    },
  });

  const uploadPaymentProof = useMutation({
    mutationFn: async ({ paymentId, file }: { paymentId: string; file: File }) => {
      const filePath = `${paymentId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(filePath);

      const { data, error } = await supabase
        .from("payment_proof_images")
        .insert({
          payment_id: paymentId,
          image_url: urlData.publicUrl,
          parse_status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-payments", quotationId] });
      toast.success("Payment proof uploaded");
    },
    onError: (error: Error) => {
      console.error("Error uploading proof:", error);
      toast.error("Failed to upload payment proof");
    },
  });

  return {
    payments,
    isLoading,
    createPayment,
    deletePayment,
    uploadPaymentProof,
    totalPaid: payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };
}
