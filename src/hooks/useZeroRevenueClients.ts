import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useZeroRevenueClients = () => {
  return useQuery<string[]>({
    queryKey: ['zero-revenue-clients'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Fetch all unique company names from clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('company_name')
        .order('company_name', { ascending: true });

      if (clientsError) throw clientsError;

      // Get unique company names as strings
      const allCompanyNames = clients?.map(c => c.company_name).filter(Boolean) || [];
      const uniqueCompanyNames = Array.from(new Set(allCompanyNames));

      // Fetch all closed projects with revenue to get which clients have revenue
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('client_id')
        .eq('status', 'closed')
        .gt('final_afactor', 0);

      if (projectsError) throw projectsError;

      // Create a set of company names that have closed projects with revenue
      const companiesWithRevenue = new Set(
        projects?.map(p => p.client_id).filter(Boolean) || []
      );

      // Filter to get only companies with zero revenue
      const zeroRevenueCompanies = uniqueCompanyNames.filter(
        companyName => !companiesWithRevenue.has(companyName)
      );

      return zeroRevenueCompanies;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};
