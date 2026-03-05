import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MakeCallParams {
  phone_number: string;
  contact_name?: string;
  demandcom_id?: string;
  first_message?: string;
}

interface VapiCallLog {
  id: string;
  demandcom_id: string | null;
  vapi_call_id: string | null;
  assistant_id: string | null;
  phone_number: string | null;
  contact_name: string | null;
  status: string;
  duration_seconds: number | null;
  transcript: string | null;
  call_summary: string | null;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export function useVapiMakeCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MakeCallParams) => {
      const { data, error } = await supabase.functions.invoke("vapi-make-call", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Call initiated successfully");
      queryClient.invalidateQueries({ queryKey: ["vapi-call-logs"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to initiate call: ${error.message}`);
    },
  });
}

export function useVapiCallLogs(filters?: {
  status?: string;
  demandcom_id?: string;
  limit?: number;
}) {
  return useQuery<VapiCallLog[]>({
    queryKey: ["vapi-call-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("vapi_call_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.demandcom_id) {
        query = query.eq("demandcom_id", filters.demandcom_id);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as VapiCallLog[]) || [];
    },
  });
}

export function useVapiBulkCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: MakeCallParams[]) => {
      const results: { success: boolean; phone: string; error?: string }[] = [];

      for (const contact of contacts) {
        try {
          const { data, error } = await supabase.functions.invoke("vapi-make-call", {
            body: contact,
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          results.push({ success: true, phone: contact.phone_number });
        } catch (err) {
          results.push({
            success: false,
            phone: contact.phone_number,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
        // Delay between calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      return results;
    },
    onSuccess: (results) => {
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      toast.success(`Bulk call complete: ${succeeded} succeeded, ${failed} failed`);
      queryClient.invalidateQueries({ queryKey: ["vapi-call-logs"] });
    },
    onError: (error: Error) => {
      toast.error(`Bulk call failed: ${error.message}`);
    },
  });
}
