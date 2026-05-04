import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useIsAdmin = (): boolean => {
  const { data } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      return (roles || []).some(
        (r) =>
          r.role === "platform_admin" ||
          r.role === "super_admin" ||
          (typeof r.role === "string" && r.role.includes("admin")),
      );
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  return Boolean(data);
};
