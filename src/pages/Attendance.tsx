import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogOut, Calendar, Camera, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatTimeIST, formatTimeShortIST, formatInIST, getCurrentTimeIST, getNowISTISOString, getTodayIST } from "@/lib/dateUtils";
import { AttendanceCapture } from "@/components/attendance/AttendanceCapture";
import { AttendanceRegularizationDialog } from "@/components/attendance/AttendanceRegularizationDialog";
import { MyRegularizationRequests } from "@/components/attendance/MyRegularizationRequests";
import { DayWiseAttendanceTable } from "@/components/attendance/DayWiseAttendanceTable";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function Attendance() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCaptureDialog, setShowCaptureDialog] = useState(false);
  const [showRegularizationDialog, setShowRegularizationDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: todayAttendance, isLoading: loadingToday } = useQuery({
    queryKey: ["attendance-today", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const today = getTodayIST();
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: recentAttendance } = useQuery({
    queryKey: ["attendance-recent", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(7);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: monthlyStats } = useQuery({
    queryKey: ["attendance-monthly", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const endOfMonth = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", startOfMonth)
        .lte("date", endOfMonth);
      
      if (error) throw error;
      
      const presentDays = data?.filter(r => r.status === "present").length || 0;
      const halfDays = data?.filter(r => r.status === "half_day").length || 0;
      const totalHours = data?.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0) || 0;
      
      return { presentDays, halfDays, totalHours, totalDays: data?.length || 0 };
    },
    enabled: !!user?.id,
  });

  // Simple sign-out mutation (no photo/GPS required)
  const signOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayAttendance?.id || !todayAttendance.sign_in_time) {
        throw new Error("No attendance record found");
      }

      const signOutTime = getNowISTISOString();
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
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-recent"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-gate-check"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-reminder-check"] });
    },
    onError: (error) => {
      toast.error("Failed to sign out: " + error.message);
    },
  });

  const handleSignInClick = () => {
    setShowCaptureDialog(true);
  };

  const handleCaptureComplete = () => {
    setShowCaptureDialog(false);
    queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-recent"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-gate-check"] });
  };

  const handleCaptureCancel = () => {
    setShowCaptureDialog(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      present: "default",
      half_day: "secondary",
      absent: "destructive",
      on_leave: "secondary",
    };
    return <Badge variant={variants[status] || "default"}>{status.replace("_", " ").toUpperCase()}</Badge>;
  };

  const calculateWorkedHours = () => {
    if (!todayAttendance?.sign_in_time) return "00:00:00";
    const signIn = new Date(todayAttendance.sign_in_time);
    const now = todayAttendance.sign_out_time ? new Date(todayAttendance.sign_out_time) : new Date();
    const diff = now.getTime() - signIn.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Track your daily attendance</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setShowRegularizationDialog(true)}>
            <FileEdit className="mr-2 h-4 w-4" />
            Request Regularization
          </Button>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatInIST(currentTime, "HH:mm:ss")}</div>
            <div className="text-sm text-muted-foreground">{formatInIST(currentTime, "EEEE, MMMM d, yyyy")} (IST)</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingToday ? (
              <div>Loading...</div>
            ) : !todayAttendance ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">You haven't signed in today</p>
                <Button 
                  onClick={handleSignInClick}
                  disabled={loadingToday}
                  size="lg"
                  className="w-full"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Check In with Photo & GPS
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(todayAttendance.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sign In (IST):</span>
                  <span className="font-semibold">
                    {todayAttendance.sign_in_time ? formatTimeIST(todayAttendance.sign_in_time) : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sign Out (IST):</span>
                  <span className="font-semibold">
                    {todayAttendance.sign_out_time ? formatTimeIST(todayAttendance.sign_out_time) : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hours Worked:</span>
                  <span className="font-semibold text-lg">{todayAttendance.total_hours?.toFixed(2) || calculateWorkedHours()}</span>
                </div>
                {!todayAttendance.sign_out_time && (
                  <Button 
                    onClick={() => signOutMutation.mutate()}
                    disabled={signOutMutation.isPending}
                    size="lg"
                    className="w-full"
                    variant="destructive"
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    {signOutMutation.isPending ? "Signing Out..." : "Check Out"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Present Days:</span>
                <span className="font-semibold text-lg">{monthlyStats?.presentDays || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Half Days:</span>
                <span className="font-semibold text-lg">{monthlyStats?.halfDays || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Days:</span>
                <span className="font-semibold text-lg">{monthlyStats?.totalDays || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Hours:</span>
                <span className="font-semibold text-lg">{monthlyStats?.totalHours.toFixed(2) || "0.00"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Day-wise Attendance Table */}
      {user && <DayWiseAttendanceTable userId={user.id} />}

      <MyRegularizationRequests />

      {/* Sign-In Capture Dialog (only for sign-in, with photo & GPS) */}
      <Dialog open={showCaptureDialog} onOpenChange={setShowCaptureDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {user && (
            <AttendanceCapture
              type="sign_in"
              userId={user.id}
              onComplete={handleCaptureComplete}
              onCancel={handleCaptureCancel}
            />
          )}
        </DialogContent>
      </Dialog>

      <AttendanceRegularizationDialog 
        open={showRegularizationDialog} 
        onOpenChange={setShowRegularizationDialog} 
      />
    </div>
  );
}
