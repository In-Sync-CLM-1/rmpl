import { useMemo } from "react";
import { format, parseISO, eachDayOfInterval, getDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatLocalDateString } from "@/lib/dateUtils";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  location?: string | null;
  employee_salary_details?: Array<{
    employee_code: string | null;
    department: string | null;
  }>;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: string;
  sign_in_time: string | null;
  sign_out_time: string | null;
  total_hours: number | null;
}

interface LeaveApplication {
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  is_half_day?: boolean;
}

interface CompanyHoliday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  is_optional: boolean;
  applicable_locations?: string[] | null;
}

interface AdminDateWiseGridProps {
  fromDate: string;
  toDate: string;
  users: UserProfile[];
  attendanceRecords: AttendanceRecord[];
  leaveApplications: LeaveApplication[];
  holidays: CompanyHoliday[];
}

type DayStatus = "P" | "A" | "H" | "L" | "WO" | "HD" | "-";

const statusColors: Record<DayStatus, string> = {
  P: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  A: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  H: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  L: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  WO: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  HD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "-": "bg-muted text-muted-foreground",
};

const statusLabels: Record<DayStatus, string> = {
  P: "Present",
  A: "Absent",
  H: "Holiday",
  L: "Leave",
  WO: "Week Off",
  HD: "Half Day",
  "-": "No Data",
};

export function AdminDateWiseGrid({
  fromDate,
  toDate,
  users,
  attendanceRecords,
  leaveApplications,
  holidays,
}: AdminDateWiseGridProps) {
  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: parseISO(fromDate),
      end: parseISO(toDate),
    });
  }, [fromDate, toDate]);

  // Check if a date is a week-off (Sunday or 2nd/4th Saturday)
  const isWeekOff = (date: Date): boolean => {
    const dayOfWeek = getDay(date);
    
    // Sunday is always a week-off
    if (dayOfWeek === 0) return true;
    
    // Check for 2nd and 4th Saturday
    if (dayOfWeek === 6) {
      const dayOfMonth = date.getDate();
      const weekOfMonth = Math.ceil(dayOfMonth / 7);
      return weekOfMonth === 2 || weekOfMonth === 4;
    }
    
    return false;
  };

  // Check if date is a holiday for user's location
  const isHoliday = (date: Date, userLocation?: string | null): CompanyHoliday | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return holidays.find(h => {
      if (h.holiday_date !== dateStr) return false;
      if (h.is_optional) return false; // Skip optional holidays
      if (!h.applicable_locations || h.applicable_locations.length === 0) return true;
      return userLocation ? h.applicable_locations.includes(userLocation) : true;
    }) || null;
  };

  // Check if user has leave on date
  const hasLeave = (date: Date, userId: string): LeaveApplication | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return leaveApplications.find(l => 
      l.user_id === userId && 
      dateStr >= l.start_date && 
      dateStr <= l.end_date
    ) || null;
  };

  // Get attendance record for user on date
  const getAttendance = (date: Date, userId: string): AttendanceRecord | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return attendanceRecords.find(r => 
      r.user_id === userId && 
      r.date === dateStr
    ) || null;
  };

  const getDayStatus = (date: Date, userId: string, userLocation?: string | null): DayStatus => {
    const today = new Date();
    
    // Future dates
    if (date > today) return "-";
    
    // Priority 1: Attendance record exists (highest priority)
    const attendance = getAttendance(date, userId);
    if (attendance) {
      if (attendance.status === "present" && attendance.sign_out_time) return "P";
      if (attendance.status === "half_day") return "HD";
      if (attendance.status === "absent") return "A";
      // If signed in but not signed out, consider present for that day
      if (attendance.sign_in_time && !attendance.sign_out_time) return "P";
    }
    
    // Priority 2: Approved leave
    const leave = hasLeave(date, userId);
    if (leave) {
      return leave.is_half_day ? "HD" : "L";
    }
    
    // Priority 3: Week-off (Sundays, 2nd/4th Saturdays)
    if (isWeekOff(date)) return "WO";
    
    // Priority 4: Company holiday
    if (isHoliday(date, userLocation)) return "H";
    
    // Otherwise: Absent
    return "A";
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(statusColors) as DayStatus[]).filter(s => s !== "-").map((status) => (
          <div key={status} className="flex items-center gap-1 text-xs">
            <Badge variant="outline" className={cn("text-[10px] px-1.5", statusColors[status])}>
              {status}
            </Badge>
            <span className="text-muted-foreground">{statusLabels[status]}</span>
          </div>
        ))}
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/90 p-2 text-left font-medium min-w-[200px]">
                  Employee
                </th>
                <th className="sticky left-[200px] z-10 bg-muted/90 p-2 text-left font-medium min-w-[100px]">
                  Emp Code
                </th>
                {daysInMonth.map((date) => {
                  const dayOfWeek = getDay(date);
                  const isSunday = dayOfWeek === 0;
                  const isSaturday = dayOfWeek === 6;
                  
                  return (
                    <th
                      key={formatLocalDateString(date)}
                      className={cn(
                        "p-1 text-center font-medium min-w-[32px]",
                        isSunday && "bg-red-50 dark:bg-red-950/20",
                        isSaturday && "bg-blue-50 dark:bg-blue-950/20"
                      )}
                    >
                      <div className="text-[10px] text-muted-foreground">
                        {format(date, "EEE").charAt(0)}
                      </div>
                      <div>{format(date, "d")}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-background p-2 min-w-[200px]">
                    <div className="font-medium truncate">{user.full_name || "N/A"}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </td>
                  <td className="sticky left-[200px] z-10 bg-background p-2 min-w-[100px]">
                    <span className="text-xs text-muted-foreground">
                      {user.employee_salary_details?.[0]?.employee_code || "-"}
                    </span>
                  </td>
                  {daysInMonth.map((date) => {
                    const status = getDayStatus(date, user.id, user.location);
                    return (
                      <td key={formatLocalDateString(date)} className="p-1 text-center">
                        {status !== "-" ? (
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1 py-0", statusColors[status])}
                            title={statusLabels[status]}
                          >
                            {status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={daysInMonth.length + 2} className="p-8 text-center text-muted-foreground">
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
