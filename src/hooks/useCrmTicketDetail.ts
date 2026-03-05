import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TicketComment {
  id: string;
  comment: string | null;
  created_by: string | null;
  created_at: string | null;
  type: 'comment';
}

export interface TicketEscalation {
  id: string;
  remarks: string | null;
  escalated_by: string | null;
  escalated_to: string | null;
  attachments: any;
  created_at: string | null;
  type: 'escalation';
}

export interface TicketHistory {
  id: string;
  action: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  created_at: string | null;
  type: 'history';
}

export type TimelineEntry = TicketComment | TicketEscalation | TicketHistory;

export function useCrmTicketDetail(ticketId: string | null) {
  const commentsQuery = useQuery({
    queryKey: ['crm-ticket-comments', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from('crm_ticket_comments')
        .select('*')
        .eq('crm_ticket_id', ticketId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(c => ({ ...c, type: 'comment' as const }));
    },
    enabled: !!ticketId,
  });

  const escalationsQuery = useQuery({
    queryKey: ['crm-ticket-escalations', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from('crm_ticket_escalations')
        .select('*')
        .eq('crm_ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(e => ({ ...e, type: 'escalation' as const }));
    },
    enabled: !!ticketId,
  });

  const historyQuery = useQuery({
    queryKey: ['crm-ticket-history', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from('crm_ticket_history')
        .select('*')
        .eq('crm_ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(h => ({ ...h, type: 'history' as const }));
    },
    enabled: !!ticketId,
  });

  // Merge all into a chronological timeline
  const timeline: TimelineEntry[] = [
    ...(commentsQuery.data || []),
    ...(escalationsQuery.data || []),
    ...(historyQuery.data || []),
  ].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateA - dateB;
  });

  return {
    timeline,
    isLoading: commentsQuery.isLoading || escalationsQuery.isLoading || historyQuery.isLoading,
    error: commentsQuery.error || escalationsQuery.error || historyQuery.error,
  };
}
