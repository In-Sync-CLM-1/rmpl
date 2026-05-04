import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";
import { useBusinessHours } from "./useBusinessHours";

export interface WhatsAppMessage {
  id: string;
  demandcom_id: string | null;
  phone_number: string;
  message_content: string | null;
  direction: "inbound" | "outbound";
  template_id: string | null;
  template_name: string | null;
  template_variables: Record<string, string> | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed" | "received";
  exotel_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  media_url: string | null;
  media_type: string | null;
  sent_by: string | null;
  created_at: string;
  sender?: {
    full_name: string | null;
  };
}

interface SendMessageParams {
  phoneNumber: string;
  demandcomId?: string;
  message?: string;
  templateId?: string;
  templateName?: string;
  templateVariables?: Record<string, string>;
  templateComponents?: Array<{
    type: string;
    parameters: Array<{ type: string; text: string }>;
  }>;
  mediaType?: "image" | "document" | "video" | "audio";
  mediaUrl?: string;
  mediaCaption?: string;
}

export function useWhatsAppMessages(demandcomId?: string, phoneNumber?: string) {
  const queryClient = useQueryClient();
  const { liveUpdatesActive } = useBusinessHours();

  const queryKey = demandcomId
    ? ["whatsapp-messages", "demandcom", demandcomId, phoneNumber]
    : phoneNumber
    ? ["whatsapp-messages", "phone", phoneNumber]
    : ["whatsapp-messages", "all"];

  const { data: messages = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (demandcomId && phoneNumber) {
        // Query by both demandcom_id OR phone_number (last 10 digits) to catch
        // inbound messages where demandcom_id wasn't resolved during webhook
        const digits = phoneNumber.replace(/[^\d]/g, '');
        const last10 = digits.slice(-10);

        const { data, error } = await supabase
          .from("whatsapp_messages")
          .select(`
            *,
            sender:profiles!sent_by(full_name)
          `)
          .or(`demandcom_id.eq.${demandcomId},phone_number.ilike.%${last10}`)
          .order("sent_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        return data as WhatsAppMessage[];
      }

      let query = supabase
        .from("whatsapp_messages")
        .select(`
          *,
          sender:profiles!sent_by(full_name)
        `)
        .order("sent_at", { ascending: false });

      if (demandcomId) {
        query = query.eq("demandcom_id", demandcomId);
      } else if (phoneNumber) {
        query = query.eq("phone_number", phoneNumber);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!demandcomId || !!phoneNumber || (!demandcomId && !phoneNumber),
  });

  // Set up realtime subscriptions — listen on both demandcom_id and phone_number
  // so inbound messages (which may have null demandcom_id) still trigger refresh
  useEffect(() => {
    if (!liveUpdatesActive) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    if (demandcomId) {
      const ch = supabase
        .channel(`wa_msg_dc_${demandcomId}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "whatsapp_messages",
          filter: `demandcom_id=eq.${demandcomId}`,
        }, invalidate)
        .subscribe();
      channels.push(ch);
    }

    if (phoneNumber) {
      const ch = supabase
        .channel(`wa_msg_ph_${phoneNumber}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "whatsapp_messages",
          filter: `phone_number=eq.${phoneNumber}`,
        }, invalidate)
        .subscribe();
      channels.push(ch);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [demandcomId, phoneNumber, queryClient, queryKey, liveUpdatesActive]);

  const sendMessage = useMutation({
    mutationFn: async (params: SendMessageParams) => {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new Error("Your session has expired — please log in again");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${refreshed.session.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        let serverMessage: string | undefined;
        try { serverMessage = (await response.json())?.error; } catch { /* ignore */ }
        throw new Error(serverMessage || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to send message");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("WhatsApp message sent successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  return {
    messages,
    isLoading,
    error,
    sendMessage: sendMessage.mutate,
    isSending: sendMessage.isPending,
  };
}
