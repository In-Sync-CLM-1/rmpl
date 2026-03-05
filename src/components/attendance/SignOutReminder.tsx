import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Bell, X } from "lucide-react";
import { toast } from "sonner";

interface SignOutReminderProps {
  user: User | null;
}

const REMINDER_STORAGE_KEY = "attendance_reminder_dismissed";
const SNOOZE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const getISTTime = () => {
  const now = new Date();
  const istOffset = 5.5 * 60; // IST is UTC + 5:30 in minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffset) % (24 * 60);
  return {
    hours: Math.floor(istMinutes / 60),
    minutes: Math.floor(istMinutes % 60),
  };
};

const getTodayKey = () => new Date().toISOString().split("T")[0];

export function SignOutReminder({ user }: SignOutReminderProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: todayAttendance } = useQuery({
    queryKey: ["attendance-reminder-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const today = getTodayKey();
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, sign_in_time, sign_out_time")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refetch every minute
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayAttendance?.id || !todayAttendance.sign_in_time) {
        throw new Error("No attendance record found");
      }

      const signOutTime = new Date().toISOString();
      const signInTime = new Date(todayAttendance.sign_in_time);
      const totalHours = (new Date().getTime() - signInTime.getTime()) / 3600000;

      const { error } = await supabase
        .from("attendance_records")
        .update({
          sign_out_time: signOutTime,
          total_hours: totalHours,
        })
        .eq("id", todayAttendance.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Signed out successfully!");
      setShowReminder(false);
      queryClient.invalidateQueries({ queryKey: ["attendance-reminder-check"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-recent"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
    },
    onError: (error) => {
      toast.error("Failed to sign out: " + error.message);
    },
  });

  const isDismissedForToday = useCallback(() => {
    try {
      const stored = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (stored) {
        const { date } = JSON.parse(stored);
        return date === getTodayKey();
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }, []);

  const dismissForToday = () => {
    localStorage.setItem(
      REMINDER_STORAGE_KEY,
      JSON.stringify({ date: getTodayKey() })
    );
    setShowReminder(false);
  };

  const snoozeReminder = () => {
    setSnoozedUntil(Date.now() + SNOOZE_DURATION_MS);
    setShowReminder(false);
    toast.info("Reminder snoozed for 30 minutes");
  };

  const handleSignOut = () => {
    signOutMutation.mutate();
  };

  // Check time every minute
  useEffect(() => {
    const checkTime = () => {
      if (!user?.id || !todayAttendance) return;
      
      // Check if user is signed in but not signed out
      if (!todayAttendance.sign_in_time || todayAttendance.sign_out_time) return;
      
      // Check if dismissed for today
      if (isDismissedForToday()) return;
      
      // Check if snoozed
      if (snoozedUntil && Date.now() < snoozedUntil) return;

      const istTime = getISTTime();
      
      // Trigger at 18:30 IST or later
      if (istTime.hours > 18 || (istTime.hours === 18 && istTime.minutes >= 30)) {
        setShowReminder(true);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user?.id, todayAttendance, isDismissedForToday, snoozedUntil]);

  if (!user) return null;

  return (
    <Dialog open={showReminder} onOpenChange={setShowReminder}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <Bell className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <DialogTitle className="text-xl">Time to Sign Out!</DialogTitle>
          <DialogDescription className="text-base">
            It's past 6:30 PM. Would you like to sign out for the day?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Clock className="h-5 w-5" />
          <span>
            Signed in at{" "}
            {todayAttendance?.sign_in_time
              ? new Date(todayAttendance.sign_in_time).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </span>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={dismissForToday}
            className="w-full sm:w-auto"
          >
            <X className="mr-2 h-4 w-4" />
            Not Today
          </Button>
          <Button
            variant="secondary"
            onClick={snoozeReminder}
            className="w-full sm:w-auto"
          >
            <Clock className="mr-2 h-4 w-4" />
            Remind Later
          </Button>
          <Button
            onClick={handleSignOut}
            disabled={signOutMutation.isPending}
            className="w-full sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {signOutMutation.isPending ? "Signing Out..." : "Sign Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
