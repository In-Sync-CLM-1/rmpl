import { useState, useEffect } from "react";
import { getRolePermissions, Permissions } from "@/lib/rolePermissions";
import { supabase } from "@/integrations/supabase/client";

export const useUserPermissions = (): {
  permissions: Permissions;
  userRoles: string[];
  isLoading: boolean;
} => {
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | undefined>();
  const [hasSubordinates, setHasSubordinates] = useState(false);
  const [userTeamNames, setUserTeamNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRolesAndUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user?.id) {
        setUserId(session.user.id);

        // Fetch roles, subordinates, and team memberships in parallel
        const [rolesResult, subordinatesResult, teamsResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('reports_to', session.user.id),
          supabase
            .from('team_members')
            .select('teams:team_id(name)')
            .eq('user_id', session.user.id)
            .eq('is_active', true)
        ]);

        setUserRoles(rolesResult.data?.map(r => r.role) || []);
        setHasSubordinates((subordinatesResult.count || 0) > 0);
        const teamNames = teamsResult.data
          ?.map((tm: any) => tm.teams?.name)
          .filter(Boolean) || [];
        setUserTeamNames(teamNames);
      }
      setIsLoading(false);
    };
    fetchRolesAndUser();
  }, []);

  const permissions = getRolePermissions(userRoles, userId, hasSubordinates, userTeamNames);

  return { permissions, userRoles, isLoading };
};
