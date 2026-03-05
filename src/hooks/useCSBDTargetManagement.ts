import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CSBDMember {
  id: string;
  full_name: string | null;
  email: string | null;
  reports_to: string | null;
}

interface CSBDTarget {
  id: string;
  user_id: string;
  fiscal_year: number;
  annual_target_inr_lacs: number;
  existing_business_target_inr_lacs: number;
  new_business_target_inr_lacs: number;
  has_subordinates: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CSBDTargetWithUser extends CSBDTarget {
  user: CSBDMember;
  subordinates?: CSBDMember[];
  team_total?: number;
}

interface TargetInput {
  user_id: string;
  fiscal_year: number;
  existing_business_target_inr_lacs: number;
  new_business_target_inr_lacs: number;
  has_subordinates?: boolean;
  is_active?: boolean;
}

export const useCSBDTargetManagement = (fiscalYear: number) => {
  const queryClient = useQueryClient();

  // Fetch all CSBD team members (based on team membership - any team containing 'CSBD' in name)
  const { data: csbdMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['csbd-members-by-team'],
    queryFn: async () => {
      // Step 1: Get all teams with 'CSBD' in the name
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .ilike('name', '%CSBD%');

      if (teamsError) throw teamsError;
      if (!teamsData || teamsData.length === 0) return [];

      const teamIds = teamsData.map(t => t.id);

      // Step 2: Get all active members from those teams
      const { data: teamMembersData, error: membersError } = await supabase
        .from('team_members')
        .select('user_id')
        .in('team_id', teamIds)
        .eq('is_active', true);

      if (membersError) throw membersError;
      if (!teamMembersData || teamMembersData.length === 0) return [];

      // Get unique user IDs (a user can be in multiple CSBD teams)
      const uniqueUserIds = [...new Set(teamMembersData.map(m => m.user_id))];

      // Step 3: Fetch profiles for those users
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, reports_to')
        .in('id', uniqueUserIds);

      if (profileError) throw profileError;

      const members: CSBDMember[] = profileData?.map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        reports_to: profile.reports_to,
      })) || [];

      return members;
    },
  });

  // Fetch targets for the selected fiscal year
  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ['csbd-targets', fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('csbd_targets')
        .select('*')
        .eq('fiscal_year', fiscalYear);

      if (error) throw error;
      return data as CSBDTarget[];
    },
  });

  // Fetch subordinates for users who have them
  const { data: subordinatesMap, isLoading: subordinatesLoading } = useQuery({
    queryKey: ['csbd-subordinates', csbdMembers?.map(m => m.id)],
    enabled: !!csbdMembers && csbdMembers.length > 0,
    queryFn: async () => {
      if (!csbdMembers) return {};
      
      const csbdIds = csbdMembers.map(m => m.id);
      
      // Fetch all profiles who report to any CSBD member
      const { data: subordinates, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, reports_to')
        .in('reports_to', csbdIds);

      if (error) throw error;

      // Group subordinates by their manager
      const grouped: Record<string, CSBDMember[]> = {};
      subordinates?.forEach((sub: any) => {
        if (sub.reports_to) {
          if (!grouped[sub.reports_to]) {
            grouped[sub.reports_to] = [];
          }
          grouped[sub.reports_to].push({
            id: sub.id,
            full_name: sub.full_name,
            email: sub.email,
            reports_to: sub.reports_to,
          });
        }
      });

      return grouped;
    },
  });

  // Combine members with their targets - memoized to prevent unnecessary re-renders
  const targetsWithUsers: CSBDTargetWithUser[] = useMemo(() => {
    return csbdMembers?.map((member) => {
      const existingTarget = targets?.find((t) => t.user_id === member.id);
      const subordinates = subordinatesMap?.[member.id] || [];
      
      const baseTarget = existingTarget ? {
        ...existingTarget,
        existing_business_target_inr_lacs: existingTarget.existing_business_target_inr_lacs ?? 0,
        new_business_target_inr_lacs: existingTarget.new_business_target_inr_lacs ?? 0,
        user: member,
      } : {
        id: '',
        user_id: member.id,
        fiscal_year: fiscalYear,
        annual_target_inr_lacs: 0,
        existing_business_target_inr_lacs: 0,
        new_business_target_inr_lacs: 0,
        has_subordinates: subordinates.length > 0,
        is_active: true,
        created_at: null,
        updated_at: null,
        user: member,
      };

      const totalTarget = (baseTarget.existing_business_target_inr_lacs || 0) + (baseTarget.new_business_target_inr_lacs || 0);

      return {
        ...baseTarget,
        annual_target_inr_lacs: totalTarget,
        subordinates,
        team_total: totalTarget,
      };
    }) || [];
  }, [csbdMembers, targets, fiscalYear, subordinatesMap]);

  // Upsert target mutation
  const upsertTarget = useMutation({
    mutationFn: async (input: TargetInput & { id?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const totalTarget = (input.existing_business_target_inr_lacs || 0) + (input.new_business_target_inr_lacs || 0);

      // Use proper upsert with onConflict to handle both insert and update
      const { data, error } = await supabase
        .from('csbd_targets')
        .upsert(
          {
            user_id: input.user_id,
            fiscal_year: input.fiscal_year,
            existing_business_target_inr_lacs: input.existing_business_target_inr_lacs,
            new_business_target_inr_lacs: input.new_business_target_inr_lacs,
            annual_target_inr_lacs: totalTarget,
            has_subordinates: input.has_subordinates ?? false,
            is_active: input.is_active ?? true,
            created_by: userId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,fiscal_year',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csbd-targets', fiscalYear] });
      toast.success('Target saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save target: ${error.message}`);
    },
  });

  // Delete target mutation
  const deleteTarget = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase
        .from('csbd_targets')
        .delete()
        .eq('id', targetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csbd-targets', fiscalYear] });
      toast.success('Target deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete target: ${error.message}`);
    },
  });

  const isLoading = membersLoading || targetsLoading || subordinatesLoading;

  const totalExistingTarget = targetsWithUsers
    .filter((t) => t.is_active)
    .reduce((sum, t) => sum + (t.existing_business_target_inr_lacs || 0), 0);

  const totalNewTarget = targetsWithUsers
    .filter((t) => t.is_active)
    .reduce((sum, t) => sum + (t.new_business_target_inr_lacs || 0), 0);

  const totalTarget = totalExistingTarget + totalNewTarget;

  const activeMembers = targetsWithUsers.filter((t) => t.is_active && t.id).length;

  return {
    targetsWithUsers,
    subordinatesMap,
    isLoading,
    upsertTarget,
    deleteTarget,
    totalTarget,
    totalExistingTarget,
    totalNewTarget,
    activeMembers,
  };
};
