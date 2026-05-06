import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppMessage {
  id: string;
  demandcom_id: string | null;
  phone_number: string;
  message_content: string | null;
  direction: "inbound" | "outbound";
  status: string | null;
  template_id: string | null;
  template_name: string | null;
  media_url: string | null;
  media_type: string | null;
  is_read: boolean;
  sent_at: string | null;
  created_at: string;
  contact?: {
    name: string | null;
    company_name: string | null;
  } | null;
}

export interface WhatsAppThread {
  threadKey: string;          // demandcom_id or phone number
  phoneNumber: string;
  demandcomId: string | null;
  contactName: string | null;
  companyName: string | null;
  lastMessage: WhatsAppMessage;
  unreadCount: number;
  totalCount: number;
  withinReplyWindow: boolean;  // last inbound was less than 24h ago
}

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function useWhatsAppThreads(searchQuery: string = "") {
  return useQuery({
    queryKey: ["whatsapp-threads", searchQuery],
    queryFn: async () => {
      // Fetch the most recent N messages, then group client-side by phone/demandcom.
      let query = supabase
        .from("whatsapp_messages" as any)
        .select(
          "id, demandcom_id, phone_number, message_content, direction, status, template_id, template_name, media_url, media_type, is_read, sent_at, created_at, contact:demandcom_id(name,company_name)"
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as unknown as WhatsAppMessage[];

      const groups = new Map<string, WhatsAppThread>();
      for (const msg of rows) {
        const key = msg.demandcom_id || msg.phone_number;
        let group = groups.get(key);
        if (!group) {
          const lastInboundMs = msg.direction === "inbound"
            ? new Date(msg.sent_at || msg.created_at).getTime()
            : 0;
          group = {
            threadKey: key,
            phoneNumber: msg.phone_number,
            demandcomId: msg.demandcom_id,
            contactName: msg.contact?.name || null,
            companyName: msg.contact?.company_name || null,
            lastMessage: msg,
            unreadCount: 0,
            totalCount: 0,
            withinReplyWindow: lastInboundMs > 0 && Date.now() - lastInboundMs < REPLY_WINDOW_MS,
          };
          groups.set(key, group);
        }
        group.totalCount++;
        if (msg.direction === "inbound" && !msg.is_read) group.unreadCount++;
        if (msg.direction === "inbound") {
          const ms = new Date(msg.sent_at || msg.created_at).getTime();
          if (Date.now() - ms < REPLY_WINDOW_MS) group.withinReplyWindow = true;
        }
      }

      let threads = Array.from(groups.values());

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        threads = threads.filter(
          (t) =>
            t.phoneNumber.toLowerCase().includes(q) ||
            (t.contactName || "").toLowerCase().includes(q) ||
            (t.companyName || "").toLowerCase().includes(q) ||
            (t.lastMessage.message_content || "").toLowerCase().includes(q)
        );
      }

      threads.sort((a, b) => {
        const ta = new Date(a.lastMessage.sent_at || a.lastMessage.created_at).getTime();
        const tb = new Date(b.lastMessage.sent_at || b.lastMessage.created_at).getTime();
        return tb - ta;
      });

      return threads;
    },
    staleTime: 30 * 1000,
  });
}

export function useWhatsAppThreadMessages(threadKey: string | null, isDemandcomId: boolean) {
  return useQuery({
    queryKey: ["whatsapp-thread", threadKey, isDemandcomId],
    queryFn: async () => {
      if (!threadKey) return [];
      let query = supabase
        .from("whatsapp_messages" as any)
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500);
      if (isDemandcomId) {
        query = query.eq("demandcom_id", threadKey);
      } else {
        query = query.eq("phone_number", threadKey).is("demandcom_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WhatsAppMessage[];
    },
    enabled: !!threadKey,
    staleTime: 10 * 1000,
  });
}

export function useWhatsAppUnreadCount() {
  return useQuery({
    queryKey: ["whatsapp-unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("whatsapp_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });
}

export function useMarkWhatsAppRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("whatsapp_messages" as any)
        .update({ is_read: true })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-threads"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-thread"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-unread-count"] });
    },
  });
}

export function useSendWhatsAppReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      thread,
      message,
      templateId,
      templateName,
      templateVariables,
    }: {
      thread: WhatsAppThread;
      message?: string;
      templateId?: string;
      templateName?: string;
      templateVariables?: Record<string, string>;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          phoneNumber: thread.phoneNumber,
          demandcomId: thread.demandcomId || undefined,
          message,
          templateId,
          templateName,
          templateVariables,
        },
      });
      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Message sent");
      qc.invalidateQueries({ queryKey: ["whatsapp-threads"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-thread"] });
    },
    onError: (e: Error) => toast.error("Failed to send: " + e.message),
  });
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("id, template_name, content, status")
        .eq("status", "approved")
        .order("template_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
