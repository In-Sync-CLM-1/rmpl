import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TeamLeader {
  id: string;
  name: string;
  teamMemberIds: string[];
  teamSize: number;
}

interface TeamFilterData {
  isAdmin: boolean;
  isTeamLead: boolean;
  teamLeaders: TeamLeader[];
  currentUserId: string | null;
}

const ADMIN_ROLES = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'];

export function useTeamFilter() {
  return useQuery<TeamFilterData>({
    queryKey: ['team-filter-data'],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { isAdmin: false, isTeamLead: false, teamLeaders: [], currentUserId: null };
      }

      // Get user's roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isAdmin = roles.some(r => ADMIN_ROLES.includes(r));

      // Get current user's subordinates
      const { data: mySubordinates } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('reports_to', user.id);

      const hasSubordinates = (mySubordinates?.length || 0) > 0;
      const isTeamLead = hasSubordinates && !isAdmin;

      // Get current user's profile
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      let teamLeaders: TeamLeader[] = [];

      if (isAdmin) {
        // Admin: Fetch ALL TLs who have subordinates in DemandCom teams
        // Get members of Demandcom-Calling team
        const { data: demandcomTeamMembers } = await supabase
          .from('team_members')
          .select('user_id, teams!inner(name)')
          .eq('teams.name', 'Demandcom-Calling');

        const demandcomUserIds = demandcomTeamMembers?.map(tm => tm.user_id) || [];

        // Find all managers who have subordinates in this team
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, reports_to')
          .in('id', demandcomUserIds);

        // Build manager -> subordinates map
        const managerMap = new Map<string, string[]>();
        const managerNames = new Map<string, string>();

        allProfiles?.forEach(profile => {
          if (profile.reports_to) {
            if (!managerMap.has(profile.reports_to)) {
              managerMap.set(profile.reports_to, []);
            }
            managerMap.get(profile.reports_to)!.push(profile.id);
          }
        });

        // Get manager names
        const managerIds = Array.from(managerMap.keys());
        if (managerIds.length > 0) {
          const { data: managers } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', managerIds);

          managers?.forEach(m => {
            managerNames.set(m.id, m.full_name || 'Unknown');
          });
        }

        // Build team leaders list
        managerMap.forEach((subordinateIds, managerId) => {
          const managerName = managerNames.get(managerId) || 'Unknown';
          teamLeaders.push({
            id: managerId,
            name: managerName,
            teamMemberIds: [managerId, ...subordinateIds],
            teamSize: subordinateIds.length,
          });
        });

        // Sort by team size descending
        teamLeaders.sort((a, b) => b.teamSize - a.teamSize);

      } else if (isTeamLead) {
        // TL: Only show their own team members who are also in Demandcom-Calling team
        const { data: demandcomTeamMembers } = await supabase
          .from('team_members')
          .select('user_id, teams!inner(name)')
          .eq('teams.name', 'Demandcom-Calling')
          .eq('is_active', true);

        const demandcomUserIds = new Set(demandcomTeamMembers?.map(tm => tm.user_id) || []);
        
        // Filter subordinates to only include those in Demandcom-Calling team
        const validSubordinateIds = mySubordinates
          ?.filter(s => demandcomUserIds.has(s.id))
          .map(s => s.id) || [];
        
        teamLeaders = [{
          id: user.id,
          name: 'My Team',
          teamMemberIds: [user.id, ...validSubordinateIds],
          teamSize: validSubordinateIds.length,
        }];
      }

      return {
        isAdmin,
        isTeamLead,
        teamLeaders,
        currentUserId: user.id,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
