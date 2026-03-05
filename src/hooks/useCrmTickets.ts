import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseCrmTicketsParams {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CrmTicket {
  id: string;
  external_ticket_id: string;
  ticket_number: string | null;
  subject: string | null;
  description: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  assigned_to: string | null;
  due_at: string | null;
  resolved_at: string | null;
  org_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  latest_comment?: string | null;
}

export function useCrmTickets({ status, search, page = 1, pageSize = 20 }: UseCrmTicketsParams = {}) {
  return useQuery({
    queryKey: ['crm-tickets', status, search, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('crm_tickets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`ticket_number.ilike.%${search}%,subject.ilike.%${search}%`);
      }

      const { data: tickets, error, count } = await query;
      if (error) throw error;

      // Fetch latest comment for each ticket
      if (tickets && tickets.length > 0) {
        const ticketIds = tickets.map(t => t.id);
        const { data: comments } = await supabase
          .from('crm_ticket_comments')
          .select('crm_ticket_id, comment, created_at')
          .in('crm_ticket_id', ticketIds)
          .eq('is_internal', false)
          .order('created_at', { ascending: false });

        // Map latest comment per ticket
        const latestComments = new Map<string, string>();
        if (comments) {
          for (const c of comments) {
            if (!latestComments.has(c.crm_ticket_id)) {
              latestComments.set(c.crm_ticket_id, c.comment || '');
            }
          }
        }

        const enriched: CrmTicket[] = tickets.map(t => ({
          ...t,
          latest_comment: latestComments.get(t.id) || null,
        }));

        return { tickets: enriched, total: count || 0 };
      }

      return { tickets: (tickets || []) as CrmTicket[], total: count || 0 };
    },
  });
}
