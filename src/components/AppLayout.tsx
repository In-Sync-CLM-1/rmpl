import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toast } from "sonner";
import { logError, getSupabaseErrorMessage } from "@/lib/errorLogger";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { OnboardingTrigger } from "@/components/onboarding/OnboardingTrigger";
import { NotificationBell } from "@/components/NotificationBell";
import { AttendanceGate } from "@/components/attendance/AttendanceGate";
import { SignOutReminder } from "@/components/attendance/SignOutReminder";
import { QuietHoursBanner } from "@/components/QuietHoursBanner";

import { getRolePermissions } from "@/lib/rolePermissions";

export function AppLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logError(error, {
            component: "AppLayout",
            operation: "AUTH_SESSION",
          });
          navigate("/");
          return;
        }
        
        if (!session) {
          navigate("/");
          return;
        }
        
        setUser(session.user);
        
        // Fetch user roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        const roles = rolesData?.map(r => r.role) || [];
        setUserRoles(roles);
        
        setIsLoading(false);
      } catch (error) {
        logError(error, {
          component: "AppLayout",
          operation: "AUTH_CHECK",
        });
        navigate("/");
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error: any) {
      logError(error, {
        component: "AppLayout",
        operation: "AUTH_LOGOUT",
        userId: user?.id,
      });
      toast.error(getSupabaseErrorMessage(error));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <SidebarProvider defaultOpen={true}>
        <AttendanceGate user={user} userRoles={userRoles}>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar user={user} userRoles={userRoles} onLogout={handleLogout} />
            
            <main className="flex-1 overflow-auto">
              <div className="px-4 md:px-6 py-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger className="md:hidden" />
                  </div>
                  <div className="flex items-center gap-2">
                    <NotificationBell />
                    <OnboardingTrigger />
                  </div>
                </div>
                <QuietHoursBanner />
              </div>
              <Outlet />
            </main>
          </div>
          <SignOutReminder user={user} />
        </AttendanceGate>
      </SidebarProvider>
      <OnboardingModal />
    </OnboardingProvider>
  );
}
