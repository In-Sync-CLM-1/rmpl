import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface UseAuthCheckOptions {
  redirectTo?: string;
  onAuthSuccess?: () => void;
  onAuthFailure?: () => void;
}

export function useAuthCheck({
  redirectTo = "/auth",
  onAuthSuccess,
  onAuthFailure,
}: UseAuthCheckOptions = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate(redirectTo);
        onAuthFailure?.();
      } else {
        onAuthSuccess?.();
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate(redirectTo);
        onAuthFailure?.();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo, onAuthSuccess, onAuthFailure]);

  return null;
}

export async function checkAuthSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
