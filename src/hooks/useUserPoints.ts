import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserPoint {
  id: string;
  user_id: string;
  points: number;
  activity_type: string;
  reference_id: string | null;
  description: string | null;
  earned_at: string;
  month_year: string;
}

export interface MonthlyPointSummary {
  id: string;
  user_id: string;
  team_id: string | null;
  month_year: string;
  total_points: number;
  star_tier: string;
  rank_in_team: number | null;
  is_winner: boolean;
  certificate_url: string | null;
}

export interface PointActivityType {
  id: string;
  activity_type: string;
  points_value: number;
  description: string | null;
  is_active: boolean;
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_points: number;
  star_tier: string;
  rank: number;
  team_name: string | null;
}

export const STAR_TIERS = {
  none: { label: 'No Star', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: '☆', threshold: 0 },
  bronze: { label: 'Bronze Star', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: '⭐', threshold: 50 },
  silver: { label: 'Silver Star', color: 'text-slate-400', bgColor: 'bg-slate-100', icon: '⭐⭐', threshold: 150 },
  gold: { label: 'Gold Star', color: 'text-yellow-500', bgColor: 'bg-yellow-100', icon: '⭐⭐⭐', threshold: 300 },
  platinum: { label: 'Platinum Star', color: 'text-purple-500', bgColor: 'bg-purple-100', icon: '🌟', threshold: 500 },
} as const;

export function useUserPoints(userId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current month in YYYY-MM format
  const currentMonth = new Date().toISOString().slice(0, 7);

  const staleTime = 2 * 60 * 1000; // 2 minutes for points data

  // Fetch user's points for current month
  const { data: userPoints, isLoading: isLoadingPoints } = useQuery({
    queryKey: ['user-points', userId, currentMonth],
    staleTime,
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .eq('month_year', currentMonth)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data as UserPoint[];
    },
    enabled: !!userId,
  });

  // Fetch user's monthly summary
  const { data: monthlySummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['monthly-summary', userId, currentMonth],
    staleTime,
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('monthly_point_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('month_year', currentMonth)
        .maybeSingle();

      if (error) throw error;
      return data as MonthlyPointSummary | null;
    },
    enabled: !!userId,
  });

  // Fetch activity types for reference
  const { data: activityTypes } = useQuery({
    queryKey: ['point-activity-types'],
    staleTime: 30 * 60 * 1000, // 30 minutes for reference data
    queryFn: async () => {
      const { data, error } = await supabase
        .from('point_activity_types')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data as PointActivityType[];
    },
  });

  // Fetch leaderboard for current month
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery({
    queryKey: ['leaderboard', currentMonth],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_point_summaries')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          ),
          teams:team_id (
            name
          )
        `)
        .eq('month_year', currentMonth)
        .order('total_points', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((entry, index) => ({
        user_id: entry.user_id,
        full_name: (entry.profiles as any)?.full_name || 'Unknown',
        avatar_url: (entry.profiles as any)?.avatar_url || null,
        total_points: entry.total_points,
        star_tier: entry.star_tier,
        rank: index + 1,
        team_name: (entry.teams as any)?.name || null,
      })) as LeaderboardEntry[];
    },
  });

  // Record daily activity (call this on app load/activity)
  const recordActivity = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('record_daily_activity', {
        p_user_id: userId
      });
      if (error) throw error;
    },
    onError: (error) => {
      console.error('Failed to record daily activity:', error);
    },
  });

  // Award points manually (for special cases)
  const awardPoints = useMutation({
    mutationFn: async ({ 
      userId, 
      activityType, 
      referenceId, 
      description 
    }: { 
      userId: string; 
      activityType: string; 
      referenceId?: string; 
      description?: string;
    }) => {
      const { data, error } = await supabase.rpc('award_points', {
        p_user_id: userId,
        p_activity_type: activityType,
        p_reference_id: referenceId || null,
        p_description: description || null
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (points) => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      
      if (points > 0) {
        toast({
          title: `+${points} Points!`,
          description: "Keep up the great work!",
        });
      }
    },
  });

  // Calculate progress to next tier
  const getNextTierProgress = () => {
    const currentPoints = monthlySummary?.total_points || 0;
    const currentTier = monthlySummary?.star_tier || 'none';
    
    const tierOrder = ['none', 'bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex === tierOrder.length - 1) {
      return { progress: 100, nextTier: null, pointsNeeded: 0 };
    }
    
    const nextTier = tierOrder[currentIndex + 1] as keyof typeof STAR_TIERS;
    const nextThreshold = STAR_TIERS[nextTier].threshold;
    const currentThreshold = STAR_TIERS[currentTier as keyof typeof STAR_TIERS].threshold;
    
    const progress = Math.min(
      ((currentPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
      100
    );
    const pointsNeeded = nextThreshold - currentPoints;
    
    return { progress, nextTier, pointsNeeded };
  };

  return {
    userPoints,
    monthlySummary,
    activityTypes,
    leaderboard,
    isLoading: isLoadingPoints || isLoadingSummary || isLoadingLeaderboard,
    recordActivity,
    awardPoints,
    getNextTierProgress,
    currentMonth,
    totalPoints: monthlySummary?.total_points || 0,
    starTier: monthlySummary?.star_tier || 'none',
  };
}
