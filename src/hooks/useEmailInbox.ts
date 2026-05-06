import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmailInboxRow {
  id: string;
  received_at: string;
  from_address: string;
  from_name: string | null;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  thread_token: string | null;
  email_activity_log_id: string | null;
  demandcom_id: string | null;
  is_read: boolean;
  attachments: any[] | null;
  outbound?: {
    subject: string | null;
    to_email: string;
    sent_at: string | null;
  } | null;
  contact?: {
    name: string | null;
    company_name: string | null;
  } | null;
}

export function useEmailInbox(searchQuery: string = "", filterUnread: boolean = false) {
  return useQuery({
    queryKey: ["email-inbox", searchQuery, filterUnread],
    queryFn: async () => {
      let query = supabase
        .from("email_inbox" as any)
        .select(
          "*, outbound:email_activity_log_id(subject,to_email,sent_at), contact:demandcom_id(name,company_name)"
        )
        .order("received_at", { ascending: false })
        .limit(200);
      if (filterUnread) query = query.eq("is_read", false);
      if (searchQuery.trim()) {
        const pat = `%${searchQuery.trim()}%`;
        query = query.or(
          `subject.ilike.${pat},body_text.ilike.${pat},from_address.ilike.${pat},from_name.ilike.${pat}`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EmailInboxRow[];
    },
    staleTime: 30 * 1000,
  });
}

export function useEmailInboxUnreadCount() {
  return useQuery({
    queryKey: ["email-inbox-unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("email_inbox" as any)
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });
}

export function useMarkEmailRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, isRead }: { ids: string[]; isRead: boolean }) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("email_inbox" as any)
        .update({ is_read: isRead })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-inbox"] });
      qc.invalidateQueries({ queryKey: ["email-inbox-unread-count"] });
    },
    onError: (e: Error) => toast.error("Failed to update: " + e.message),
  });
}

export function useReplyToEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inboxRow,
      bodyHtml,
      subject,
    }: {
      inboxRow: EmailInboxRow;
      bodyHtml: string;
      subject: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-simple-email", {
        body: {
          to_email: inboxRow.from_address,
          to_name: inboxRow.from_name || inboxRow.from_address,
          subject,
          html_body: bodyHtml,
          demandcom_id: inboxRow.demandcom_id || undefined,
        },
      });
      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Reply sent");
      qc.invalidateQueries({ queryKey: ["email-inbox"] });
    },
    onError: (e: Error) => toast.error("Failed to send: " + e.message),
  });
}
