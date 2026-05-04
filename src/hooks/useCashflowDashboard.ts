import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CashflowSummary {
  total_invoices: number;
  total_invoiced: number;
  total_received: number;
  pending_amount: number;
  overdue_amount: number;
}

export interface ClientPending {
  client_id: string;
  company_name: string;
  contact_name: string;
  invoice_count: number;
  pending_amount: number;
  oldest_invoice_date: string;
}

export interface RecentPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number: string | null;
  quotation: {
    quotation_number: string;
    client_name: string | null;
    project: {
      project_name: string;
    };
  };
}

export interface MonthlyData {
  month: string;
  invoiced: number;
  received: number;
}

export function useCashflowDashboard() {
  const staleTime = 24 * 60 * 60 * 1000; // 24 hours — refresh button on dashboard forces fresh data

  // Fetch cashflow summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["cashflow-summary"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashflow_summary")
        .select("*")
        .single();

      if (error) throw error;
      return data as CashflowSummary;
    },
  });

  // Fetch client-wise pending
  const { data: clientPending, isLoading: clientPendingLoading } = useQuery({
    queryKey: ["client-pending-summary"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_pending_summary")
        .select("*")
        .order("pending_amount", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ClientPending[];
    },
  });

  // Fetch recent payments
  const { data: recentPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["recent-payments"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotation_payments")
        .select(`
          id,
          amount,
          payment_date,
          payment_mode,
          reference_number,
          project_quotations!inner(
            quotation_number,
            client:clients!project_quotations_client_id_fkey(company_name),
            projects!inner(
              project_name
            )
          )
        `)
        .order("payment_date", { ascending: false })
        .limit(20);

      if (error) throw error;

      return data.map((p: any) => ({
        id: p.id,
        amount: p.amount,
        payment_date: p.payment_date,
        payment_mode: p.payment_mode,
        reference_number: p.reference_number,
        quotation: {
          quotation_number: p.project_quotations.quotation_number,
          client_name: p.project_quotations.client?.company_name || null,
          project: {
            project_name: p.project_quotations.projects.project_name,
          },
        },
      })) as RecentPayment[];
    },
  });

  // Fetch monthly data for chart
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["cashflow-monthly"],
    staleTime,
    queryFn: async () => {
      // Get quotations with payments grouped by month
      const { data: quotations, error } = await supabase
        .from("project_quotations")
        .select(`
          id,
          amount,
          created_at,
          quotation_payments(amount, payment_date)
        `)
        .not("amount", "is", null)
        .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 11)).toISOString());

      if (error) throw error;

      // Group by month
      const monthlyMap = new Map<string, { invoiced: number; received: number }>();
      
      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(key, { invoiced: 0, received: 0 });
      }

      quotations?.forEach((q: any) => {
        const invoiceMonth = new Date(q.created_at).toISOString().slice(0, 7);
        if (monthlyMap.has(invoiceMonth)) {
          const curr = monthlyMap.get(invoiceMonth)!;
          curr.invoiced += Number(q.amount) || 0;
        }

        q.quotation_payments?.forEach((p: any) => {
          const paymentMonth = new Date(p.payment_date).toISOString().slice(0, 7);
          if (monthlyMap.has(paymentMonth)) {
            const curr = monthlyMap.get(paymentMonth)!;
            curr.received += Number(p.amount) || 0;
          }
        });
      });

      return Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        invoiced: data.invoiced,
        received: data.received,
      })) as MonthlyData[];
    },
  });

  // Payment mode breakdown
  const { data: paymentModeBreakdown, isLoading: modeLoading } = useQuery({
    queryKey: ["payment-mode-breakdown"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotation_payments")
        .select("payment_mode, amount");

      if (error) throw error;

      const modeMap = new Map<string, number>();
      data?.forEach((p: any) => {
        const current = modeMap.get(p.payment_mode) || 0;
        modeMap.set(p.payment_mode, current + Number(p.amount));
      });

      return Array.from(modeMap.entries()).map(([mode, amount]) => ({
        name: mode.replace("_", " ").toUpperCase(),
        value: amount,
      }));
    },
  });

  return {
    summary,
    clientPending,
    recentPayments,
    monthlyData,
    paymentModeBreakdown,
    isLoading: summaryLoading || clientPendingLoading || paymentsLoading || monthlyLoading || modeLoading,
  };
}
