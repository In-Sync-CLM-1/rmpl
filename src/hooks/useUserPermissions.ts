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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRolesAndUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        setUserId(session.user.id);
        
        // Fetch roles and check for subordinates in parallel
        const [rolesResult, subordinatesResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('reports_to', session.user.id)
        ]);
        
        setUserRoles(rolesResult.data?.map(r => r.role) || []);
        setHasSubordinates((subordinatesResult.count || 0) > 0);
      }
      setIsLoading(false);
    };
    fetchRolesAndUser();
  }, []);

  const permissions = getRolePermissions(userRoles, userId, hasSubordinates);

  return { permissions, userRoles, isLoading };
};
