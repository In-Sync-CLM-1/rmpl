import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AttendanceCapture } from "./AttendanceCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Clock, ShieldCheck } from "lucide-react";

interface AttendanceGateProps {
  user: User | null;
  userRoles?: string[];
  children: React.ReactNode;
}

const EXEMPT_ROLES = ["platform_admin"];

export function AttendanceGate({ user, userRoles = [], children }: AttendanceGateProps) {
  const [showGate, setShowGate] = useState(false);

  // Check if user has an exempt role
  const isExempt = userRoles.some(role => EXEMPT_ROLES.includes(role));

  const { data: todayAttendance, isLoading, refetch } = useQuery({
    queryKey: ["attendance-gate-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, sign_in_time")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isLoading && user?.id) {
      // Show gate if user hasn't signed in today AND is not exempt
      setShowGate(!todayAttendance?.sign_in_time && !isExempt);
    }
  }, [todayAttendance, isLoading, user?.id, isExempt]);

  const handleCaptureComplete = () => {
    refetch();
    setShowGate(false);
  };

  if (!user) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {children}
      <Dialog open={showGate} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-xl">Attendance Required</DialogTitle>
            <DialogDescription className="text-base">
              Please complete your attendance sign-in with photo and GPS verification to access the application.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <AttendanceCapture
              type="sign_in"
              userId={user.id}
              onComplete={handleCaptureComplete}
              onCancel={() => {}} // No cancel allowed
            />
          </div>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4 pt-4 border-t">
            <Clock className="h-4 w-4" />
            <span>Sign-in is mandatory to access the application</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
