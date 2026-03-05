import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientRevenue {
  client_id: string;
  client_name: string;
  total_revenue: number;
  deals_closed: number;
  primary_owner_id: string;
  primary_owner_name: string;
  owner_breakdown: Array<{
    owner_id: string;
    owner_name: string;
    revenue: number;
    deals: number;
  }>;
}

export const useClientRevenueAnalytics = (fiscalYear = 2025) => {
  return useQuery({
    queryKey: ['client-revenue-analytics', fiscalYear],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Fetch all closed projects with final_afactor
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          id,
          client_id,
          final_afactor,
          project_owner,
          status,
          profiles!projects_project_owner_fkey(full_name)
        `)
        .eq('status', 'closed')
        .not('final_afactor', 'is', null)
        .gt('final_afactor', 0);

      if (error) throw error;

      // Fetch all clients to map company names to UUIDs
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name');

      if (clientsError) throw clientsError;

      // Create map from company_name to client UUID
      const companyToUuidMap = new Map(clients?.map(c => [c.company_name, c.id]) || []);

      // Group by client UUID
      const revenueMap = new Map<string, ClientRevenue>();

      projects?.forEach((project: any) => {
        const companyName = project.client_id; // This is the company name as text
        if (!companyName) return; // Skip projects without client_id
        
        // Look up the client UUID from the clients table
        const clientUuid = companyToUuidMap.get(companyName);
        if (!clientUuid) return; // Skip if company not found in clients table
        
        const revenue = (project.final_afactor || 0) / 100000; // Convert to lakhs
        const ownerId = project.project_owner;
        const ownerName = project.profiles?.full_name || 'Unknown';

        if (!revenueMap.has(clientUuid)) {
          revenueMap.set(clientUuid, {
            client_id: clientUuid,
            client_name: companyName,
            total_revenue: 0,
            deals_closed: 0,
            primary_owner_id: ownerId,
            primary_owner_name: ownerName,
            owner_breakdown: [],
          });
        }

        const client = revenueMap.get(clientUuid)!;
        client.total_revenue += revenue;
        client.deals_closed += 1;

        // Update owner breakdown
        const ownerIndex = client.owner_breakdown.findIndex(o => o.owner_id === ownerId);
        if (ownerIndex >= 0) {
          client.owner_breakdown[ownerIndex].revenue += revenue;
          client.owner_breakdown[ownerIndex].deals += 1;
        } else {
          client.owner_breakdown.push({
            owner_id: ownerId,
            owner_name: ownerName,
            revenue,
            deals: 1,
          });
        }

        // Update primary owner if this owner has more revenue
        if (client.owner_breakdown.length > 0) {
          const topOwner = client.owner_breakdown.reduce((max, current) => 
            current.revenue > max.revenue ? current : max
          );
          client.primary_owner_id = topOwner.owner_id;
          client.primary_owner_name = topOwner.owner_name;
        }
      });

      // Convert to array and sort by revenue
      const clientRevenues = Array.from(revenueMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue);

      return clientRevenues;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
};
