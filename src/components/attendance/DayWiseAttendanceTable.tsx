import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar, FileEdit, ChevronLeft, ChevronRight, Clock, AlertTriangle, Camera, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { formatTimeShortIST, isLateSignIn, getLateMinutes } from "@/lib/dateUtils";
import { AttendanceRegularizationDialog } from "./AttendanceRegularizationDialog";
import { useCompanyHolidays, isHolidayDate } from "@/hooks/useCompanyHolidays";

interface DayWiseAttendanceTableProps {
  userId: string;
  userLocation?: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  sign_in_time: string | null;
  sign_out_time: string | null;
  total_hours: number | null;
  status: string;
  sign_in_photo_url?: string | null;
  sign_out_photo_url?: string | null;
  sign_in_location_city?: string | null;
  sign_in_location_state?: string | null;
  sign_out_location_city?: string | null;
  sign_out_location_state?: string | null;
}

export function DayWiseAttendanceTable({ userId, userLocation = "Delhi" }: DayWiseAttendanceTableProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [regularizationDate, setRegularizationDate] = useState<string | null>(null);
  const [showRegularizationDialog, setShowRegularizationDialog] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const { holidays } = useCompanyHolidays(selectedYear);

  // Get all days in the selected month
  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch attendance for the selected month
  const { data: attendanceRecords = [], isLoading } = useQuery({
    queryKey: ["attendance-daywise", userId, selectedYear, selectedMonth],
    queryFn: async () => {
      const startDate = format(monthStart, "yyyy-MM-dd");
      const endDate = format(monthEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!userId,
  });

  // Fetch approved leaves for the selected month
  const { data: approvedLeaves = [] } = useQuery({
    queryKey: ["approved-leaves-month", userId, selectedYear, selectedMonth],
    queryFn: async () => {
      const startDate = format(monthStart, "yyyy-MM-dd");
      const endDate = format(monthEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("leave_applications")
        .select("start_date, end_date, leave_type")
        .eq("user_id", userId)
        .eq("status", "approved" as any)
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const isDateOnApprovedLeave = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return approvedLeaves.some((leave: any) => dateStr >= leave.start_date && dateStr <= leave.end_date);
  };

  const getRecordForDate = (date: Date): AttendanceRecord | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return attendanceRecords.find((r) => r.date === dateStr);
  };

  const handlePreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    const today = new Date();
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    
    // Don't allow navigating to future months
    if (nextYear > today.getFullYear() || (nextYear === today.getFullYear() && nextMonth > today.getMonth())) {
      return;
    }
    
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
  };

  const openRegularization = (date: string) => {
    setRegularizationDate(date);
    setShowRegularizationDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      present: "default",
      half_day: "secondary",
      absent: "destructive",
      on_leave: "outline",
      holiday: "outline",
      weekend: "outline",
    };
    const labels: Record<string, string> = {
      present: "Present",
      half_day: "Half Day",
      absent: "Absent",
      on_leave: "On Leave",
      holiday: "Holiday",
      weekend: "Weekend",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  // Only Sundays and 2nd/4th Saturdays are week-offs
  const isWeekOff = (date: Date): boolean => {
    const day = date.getDay();
    if (day === 0) return true; // Sunday
    if (day === 6) {
      const weekOfMonth = Math.ceil(date.getDate() / 7);
      return weekOfMonth === 2 || weekOfMonth === 4; // 2nd & 4th Saturday only
    }
    return false;
  };

  const getDayStatus = (date: Date, record?: AttendanceRecord): string => {
    if (record) return record.status;
    if (isWeekOff(date)) return "weekend";
    if (isHolidayDate(date, holidays, userLocation)) return "holiday";
    if (date <= new Date()) {
      if (isDateOnApprovedLeave(date)) return "on_leave";
      return "absent";
    }
    return "-";
  };

  const formatHours = (hours: number | null): string => {
    if (hours === null || hours === undefined) return "-";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Calculate summary stats
  const stats = {
    present: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
    totalHours: 0,
    lateDays: 0,
  };

  daysInMonth.forEach((date) => {
    if (date > new Date()) return; // Skip future dates
    
    const record = getRecordForDate(date);
    const status = getDayStatus(date, record);
    
    if (status === "present") {
      stats.present++;
      stats.totalHours += record?.total_hours || 0;
      if (record?.sign_in_time && isLateSignIn(record.sign_in_time)) {
        stats.lateDays++;
      }
    } else if (status === "half_day") {
      stats.halfDay++;
      stats.totalHours += record?.total_hours || 0;
    } else if (status === "absent") {
      stats.absent++;
    } else if (status === "on_leave") {
      stats.onLeave++;
    }
  });

  const avgHours = stats.present + stats.halfDay > 0 
    ? stats.totalHours / (stats.present + stats.halfDay) 
    : 0;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const isNextDisabled = () => {
    const today = new Date();
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    return nextYear > today.getFullYear() || (nextYear === today.getFullYear() && nextMonth > today.getMonth());
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Day-wise Attendance
              </CardTitle>
              <CardDescription>Your attendance records for the selected month</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[140px] text-center font-medium">
                {months[selectedMonth]} {selectedYear}
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNextMonth}
                disabled={isNextDisabled()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.present}</div>
              <div className="text-xs text-muted-foreground">Present</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.halfDay}</div>
              <div className="text-xs text-muted-foreground">Half Days</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.absent}</div>
              <div className="text-xs text-muted-foreground">Absent</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.onLeave}</div>
              <div className="text-xs text-muted-foreground">On Leave</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Total Hours</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{avgHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Avg Hours/Day</div>
            </div>
          </div>

          {/* Late Coming Alert */}
          {stats.lateDays > 0 && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              stats.lateDays > 3 
                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300' 
                : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300'
            }`}>
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                {stats.lateDays} late arrival{stats.lateDays > 1 ? 's' : ''} this month
                {stats.lateDays > 3 && ' - Half day leave may be deducted'}
              </span>
            </div>
          )}

          {/* Attendance Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>In-Time (IST)</TableHead>
                  <TableHead>Out-Time (IST)</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading attendance data...
                    </TableCell>
                  </TableRow>
                ) : (
                  daysInMonth.map((date) => {
                    const record = getRecordForDate(date);
                    const status = getDayStatus(date, record);
                    const isFuture = date > new Date();
                    const isToday = isSameDay(date, new Date());
                    const isLate = record?.sign_in_time && isLateSignIn(record.sign_in_time);
                    const lateMinutes = record?.sign_in_time ? getLateMinutes(record.sign_in_time) : 0;

                    return (
                      <TableRow 
                        key={date.toISOString()} 
                        className={`${
                          isToday ? 'bg-primary/5' : 
                          status === 'weekend' || status === 'holiday' ? 'bg-muted/50' : 
                          isFuture ? 'opacity-50' : ''
                        }`}
                      >
                        <TableCell className="font-medium">
                          {format(date, "dd MMM")}
                        </TableCell>
                        <TableCell>{format(date, "EEE")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {record?.sign_in_time ? formatTimeShortIST(record.sign_in_time) : "-"}
                            {isLate && (
                              <span className="text-xs text-red-500" title={`${lateMinutes} min late`}>
                                <Clock className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record?.sign_out_time ? formatTimeShortIST(record.sign_out_time) : "-"}
                        </TableCell>
                        <TableCell>{formatHours(record?.total_hours || null)}</TableCell>
                        <TableCell>{status !== "-" ? getStatusBadge(status) : "-"}</TableCell>
                        <TableCell>
                          {record?.sign_in_photo_url || record?.sign_out_photo_url ? (
                            <div className="flex gap-1">
                              {record.sign_in_photo_url && (
                                <img
                                  src={record.sign_in_photo_url}
                                  alt="Sign in"
                                  className="h-8 w-8 rounded object-cover cursor-pointer border hover:opacity-80 transition-opacity"
                                  onClick={() => setPreviewPhoto(record.sign_in_photo_url!)}
                                  title="Sign-in photo"
                                />
                              )}
                              {record.sign_out_photo_url && (
                                <img
                                  src={record.sign_out_photo_url}
                                  alt="Sign out"
                                  className="h-8 w-8 rounded object-cover cursor-pointer border hover:opacity-80 transition-opacity"
                                  onClick={() => setPreviewPhoto(record.sign_out_photo_url!)}
                                  title="Sign-out photo"
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record?.sign_in_location_city || record?.sign_out_location_city ? (
                            <div className="flex items-start gap-1 text-xs">
                              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                              <div>
                                {record.sign_in_location_city && (
                                  <div>{record.sign_in_location_city}{record.sign_in_location_state ? `, ${record.sign_in_location_state}` : ''}</div>
                                )}
                                {record.sign_out_location_city && record.sign_out_location_city !== record.sign_in_location_city && (
                                  <div className="text-muted-foreground">Out: {record.sign_out_location_city}</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isFuture && status !== 'weekend' && status !== 'holiday' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRegularization(format(date, "yyyy-MM-dd"))}
                            >
                              <FileEdit className="h-4 w-4 mr-1" />
                              Regularize
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AttendanceRegularizationDialog
        open={showRegularizationDialog}
        onOpenChange={setShowRegularizationDialog}
        prefilledDate={regularizationDate || undefined}
      />

      {/* Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-lg p-2">
          {previewPhoto && (
            <img
              src={previewPhoto}
              alt="Attendance photo"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
