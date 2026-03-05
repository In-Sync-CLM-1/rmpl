import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LiveComDashboardMetrics {
  totalEvents: number;
  totalCost: number;
  avgLiveComRating: number;
  avgCsbdRating: number;
  topVendors: Array<{
    vendor_name: string;
    event_count: number;
    total_cost: number;
    avg_rating: number;
  }>;
  teamMembers: Array<{
    user_id: string;
    user_name: string;
    event_count: number;
    total_cost: number;
    avg_livecom_rating: number;
    avg_csbd_rating: number;
  }>;
  recentEvents: Array<{
    id: string;
    project_id: string;
    project?: {
      project_number: string;
      project_name: string;
      number_of_attendees: number | null;
    };
    vendor_hotel?: {
      vendor_name: string;
    };
    services: string | null;
    internal_cost_exc_tax: number | null;
    rating_by_livecom: number | null;
    rating_by_csbd: number | null;
    created_at: string;
    registrations?: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    event_count: number;
    total_cost: number;
    avg_rating: number;
  }>;
}

export function useLiveComDashboard(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["livecom-dashboard", dateFrom, dateTo],
    queryFn: async () => {
      // Build date filter
      let query = supabase
        .from("project_livecom_events")
        .select(`
          *,
          project:projects!project_id (
            project_number,
            project_name,
            number_of_attendees
          ),
          vendor_hotel:vendors!vendor_hotel_id (
            id,
            vendor_name
          )
        `);

      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo);
      }

      const { data: events, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch registration counts from demandcom grouped by activity_name
      const uniqueProjectNames = [...new Set(
        events?.map(e => e.project?.project_name).filter(Boolean) as string[]
      )];

      const registrationMap = new Map<string, number>();
      if (uniqueProjectNames.length > 0) {
        const { data: regData } = await supabase
          .from("demandcom")
          .select("activity_name")
          .eq("latest_subdisposition", "Registered")
          .in("activity_name", uniqueProjectNames);

        if (regData) {
          regData.forEach(r => {
            const name = r.activity_name!;
            registrationMap.set(name, (registrationMap.get(name) || 0) + 1);
          });
        }
      }

      // Enrich events with registration counts
      const enrichedEvents = events?.map(e => ({
        ...e,
        registrations: e.project?.project_name ? (registrationMap.get(e.project.project_name) || 0) : 0,
      })) || [];

      // Fetch profiles for team members
      const uniqueUserIds = [...new Set(events?.map(e => e.created_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Calculate metrics
      const totalEvents = events?.length || 0;
      const totalCost = events?.reduce((sum, e) => sum + (e.internal_cost_exc_tax || 0), 0) || 0;
      
      const liveComRatings = events?.filter(e => e.rating_by_livecom) || [];
      const avgLiveComRating = liveComRatings.length > 0
        ? liveComRatings.reduce((sum, e) => sum + (e.rating_by_livecom || 0), 0) / liveComRatings.length
        : 0;

      const csbdRatings = events?.filter(e => e.rating_by_csbd) || [];
      const avgCsbdRating = csbdRatings.length > 0
        ? csbdRatings.reduce((sum, e) => sum + (e.rating_by_csbd || 0), 0) / csbdRatings.length
        : 0;

      // Top vendors
      const vendorMap = new Map<string, {
        vendor_name: string;
        event_count: number;
        total_cost: number;
        ratings: number[];
      }>();

      events?.forEach(event => {
        if (event.vendor_hotel?.vendor_name) {
          const vendorName = event.vendor_hotel.vendor_name;
          const existing = vendorMap.get(vendorName) || {
            vendor_name: vendorName,
            event_count: 0,
            total_cost: 0,
            ratings: [],
          };

          existing.event_count += 1;
          existing.total_cost += event.internal_cost_exc_tax || 0;
          if (event.rating_by_livecom) {
            existing.ratings.push(event.rating_by_livecom);
          }

          vendorMap.set(vendorName, existing);
        }
      });

      const topVendors = Array.from(vendorMap.values())
        .map(v => ({
          vendor_name: v.vendor_name,
          event_count: v.event_count,
          total_cost: v.total_cost,
          avg_rating: v.ratings.length > 0
            ? v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length
            : 0,
        }))
        .sort((a, b) => b.event_count - a.event_count)
        .slice(0, 5);

      // Monthly trends
      const monthlyMap = new Map<string, {
        event_count: number;
        total_cost: number;
        ratings: number[];
      }>();

      events?.forEach(event => {
        const month = new Date(event.created_at).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        const existing = monthlyMap.get(month) || {
          event_count: 0,
          total_cost: 0,
          ratings: [],
        };

        existing.event_count += 1;
        existing.total_cost += event.internal_cost_exc_tax || 0;
        if (event.rating_by_livecom) {
          existing.ratings.push(event.rating_by_livecom);
        }

        monthlyMap.set(month, existing);
      });

      const monthlyTrends = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          event_count: data.event_count,
          total_cost: data.total_cost,
          avg_rating: data.ratings.length > 0
            ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
            : 0,
        }))
        .slice(-6); // Last 6 months

      // Team member analysis
      const teamMemberMap = new Map<string, {
        user_id: string;
        user_name: string;
        event_count: number;
        total_cost: number;
        livecom_ratings: number[];
        csbd_ratings: number[];
      }>();

      events?.forEach(event => {
        if (event.created_by) {
          const userId = event.created_by;
          const userName = profileMap.get(userId) || 'Unknown User';
          const existing = teamMemberMap.get(userId) || {
            user_id: userId,
            user_name: userName,
            event_count: 0,
            total_cost: 0,
            livecom_ratings: [],
            csbd_ratings: [],
          };

          existing.event_count += 1;
          existing.total_cost += event.internal_cost_exc_tax || 0;
          if (event.rating_by_livecom) {
            existing.livecom_ratings.push(event.rating_by_livecom);
          }
          if (event.rating_by_csbd) {
            existing.csbd_ratings.push(event.rating_by_csbd);
          }

          teamMemberMap.set(userId, existing);
        }
      });

      const teamMembers = Array.from(teamMemberMap.values())
        .map(tm => ({
          user_id: tm.user_id,
          user_name: tm.user_name,
          event_count: tm.event_count,
          total_cost: tm.total_cost,
          avg_livecom_rating: tm.livecom_ratings.length > 0
            ? tm.livecom_ratings.reduce((a, b) => a + b, 0) / tm.livecom_ratings.length
            : 0,
          avg_csbd_rating: tm.csbd_ratings.length > 0
            ? tm.csbd_ratings.reduce((a, b) => a + b, 0) / tm.csbd_ratings.length
            : 0,
        }))
        .sort((a, b) => b.event_count - a.event_count);

      const metrics: LiveComDashboardMetrics = {
        totalEvents,
        totalCost,
        avgLiveComRating,
        avgCsbdRating,
        topVendors,
        teamMembers,
        recentEvents: enrichedEvents.slice(0, 10),
        monthlyTrends,
      };

      return metrics;
    },
  });
}
