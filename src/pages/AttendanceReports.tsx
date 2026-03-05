import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Users, Calendar, Clock, TrendingUp, Search, Table2, Grid3X3 } from "lucide-react";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from "date-fns";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCompanyHolidays } from "@/hooks/useCompanyHolidays";
import { AdminDateWiseGrid } from "@/components/attendance/AdminDateWiseGrid";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  reports_to: string | null;
  location: string | null;
  employee_salary_details: Array<{
    employee_code: string | null;
    department: string | null;
  }>;
}

export default function AttendanceReports() {
  const { permissions } = useUserPermissions();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedDesignation, setSelectedDesignation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"summary" | "datewise">("summary");

  const { holidays } = useCompanyHolidays();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: users } = useQuery({
    queryKey: ["users-list-extended", selectedTeam, selectedDesignation, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, reports_to, location")
        .not("email", "in", "(a@in-sync.co.in,s.ray@redefine.in)")
        .order("full_name");
      
      if (profilesError) throw profilesError;
      if (!profiles) return [];

      // Fetch employee_salary_details separately
      const userIds = profiles.map(p => p.id);
      const { data: salaryDetails } = await supabase
        .from("employee_salary_details")
        .select("user_id, employee_code, department")
        .in("user_id", userIds);

      // Map salary details to profiles
      const profilesWithDetails: UserProfile[] = profiles.map(p => ({
        ...p,
        employee_salary_details: salaryDetails?.filter(s => s.user_id === p.id) || [],
      }));

      // Get current user's designation level
      const { data: userDesignations } = await supabase
        .from("user_designations")
        .select("designations(level)")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .single();

      const currentUserLevel = userDesignations?.designations?.level || 0;

      // Get user's roles to check if admin
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isAdmin = roles.some(r => 
        r === 'platform_admin' || 
        r === 'super_admin' || 
        r === 'admin' || 
        r === 'admin_administration' || 
        r === 'admin_tech' ||
        r === 'hr_manager'
      );

      // If admin, show all users
      if (isAdmin) {
        let filteredUsers = profilesWithDetails;

        // Apply team filter if selected
        if (selectedTeam !== "all") {
          const { data: teamMembers } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("team_id", selectedTeam);
          
          const teamUserIds = teamMembers?.map(tm => tm.user_id) || [];
          filteredUsers = filteredUsers.filter(u => teamUserIds.includes(u.id));
        }

        // Apply designation filter if selected
        if (selectedDesignation !== "all") {
          const { data: designationUsers } = await supabase
            .from("user_designations")
            .select("user_id")
            .eq("designation_id", selectedDesignation)
            .eq("is_current", true);
          
          const designationUserIds = designationUsers?.map(ud => ud.user_id) || [];
          filteredUsers = filteredUsers.filter(u => designationUserIds.includes(u.id));
        }

        return filteredUsers;
      }

      // For non-admins, apply hierarchy filtering
      const getReportingChain = (managerId: string, allProfiles: typeof profiles): string[] => {
        const directReports = allProfiles.filter(p => p.reports_to === managerId);
        let allReports = directReports.map(p => p.id);
        
        directReports.forEach(report => {
          allReports = [...allReports, ...getReportingChain(report.id, allProfiles)];
        });
        
        return allReports;
      };

      const accessibleUserIds = [user.id, ...getReportingChain(user.id, profiles)];

      let filteredUsers = profilesWithDetails.filter(p => accessibleUserIds.includes(p.id));

      if (selectedTeam !== "all") {
        const { data: teamMembers } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", selectedTeam);
        
        const teamUserIds = teamMembers?.map(tm => tm.user_id) || [];
        filteredUsers = filteredUsers.filter(u => teamUserIds.includes(u.id));
      }

      if (selectedDesignation !== "all") {
        const { data: designationUsers } = await supabase
          .from("user_designations")
          .select("user_id")
          .eq("designation_id", selectedDesignation)
          .eq("is_current", true);
        
        const designationUserIds = designationUsers?.map(ud => ud.user_id) || [];
        filteredUsers = filteredUsers.filter(u => designationUserIds.includes(u.id));
      }

      return filteredUsers;
    },
    enabled: permissions.canViewAttendanceReports && !!user?.id,
  });

  const { data: teams } = useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: designations } = useQuery({
    queryKey: ["designations-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designations")
        .select("id, title")
        .eq("is_active", true)
        .order("title");
      
      if (error) throw error;
      return data;
    },
  });

  // Extract user IDs for filtered querying to avoid PostgREST row limits
  const userIds = useMemo(() => users?.map(u => u.id) || [], [users]);

  const { data: attendanceReport, isLoading: attendanceLoading, error: attendanceError } = useQuery({
    queryKey: ["attendance-report", month, userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];

      const startDate = `${month}-01`;
      const endDate = format(new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0), "yyyy-MM-dd");
      
      // Fetch in batches of 30 user IDs to stay well within row limits
      const batchSize = 30;
      const allRecords: any[] = [];
      
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("attendance_records")
          .select("*")
          .in("user_id", batch)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false })
          .limit(2000);
        
        if (error) throw error;
        if (data) allRecords.push(...data);
      }
      
      return allRecords;
    },
    enabled: userIds.length > 0,
  });

  const { data: leaveReport, isLoading: leaveLoading, error: leaveError } = useQuery({
    queryKey: ["leave-report", month, userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];

      const startDate = `${month}-01`;
      const endDate = format(new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0), "yyyy-MM-dd");
      
      // Fetch in batches of 30 user IDs
      const batchSize = 30;
      const allRecords: any[] = [];
      
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("leave_applications")
          .select("*")
          .in("user_id", batch)
          .eq("status", "approved")
          .lte("start_date", endDate)
          .gte("end_date", startDate);
        
        if (error) throw error;
        if (data) allRecords.push(...data);
      }
      
      return allRecords;
    },
    enabled: userIds.length > 0,
  });

  // Calculate days in month for working days calculation
  const monthDays = useMemo(() => {
    const monthDate = parseISO(`${month}-01`);
    return eachDayOfInterval({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
    });
  }, [month]);

  // Check if a date is a week-off (Sunday or 2nd/4th Saturday)
  const isWeekOff = (date: Date): boolean => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 0) return true; // Sunday
    if (dayOfWeek === 6) {
      const dayOfMonth = date.getDate();
      const weekOfMonth = Math.ceil(dayOfMonth / 7);
      return weekOfMonth === 2 || weekOfMonth === 4;
    }
    return false;
  };

  // Check if date is a company holiday for user's location
  // Exclude dynamically generated 2nd/4th Saturday holidays since those are handled by isWeekOff
  const isHoliday = (date: Date, userLocation?: string | null): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return holidays?.some(h => {
      if (h.holiday_date !== dateStr) return false;
      if (h.is_optional) return false;
      // Skip generated Saturday holidays - they are counted as week-offs
      if (h.id.startsWith('sat-')) return false;
      if (!h.applicable_locations || h.applicable_locations.length === 0) return true;
      return userLocation ? h.applicable_locations.includes(userLocation) : true;
    }) || false;
  };

  const calculateUserStats = (userId: string, userLocation?: string | null) => {
    const userAttendance = attendanceReport?.filter(r => r.user_id === userId) || [];
    const userLeaves = leaveReport?.filter(l => l.user_id === userId) || [];
    const completedAttendance = userAttendance.filter(r => r.sign_out_time !== null);
    const totalHours = completedAttendance.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);

    // Day-by-day calculation with mutually exclusive status
    // Priority: Attendance > Approved Leave > Holiday > Week-off > Absent
    let presentDays = 0;
    let halfDays = 0;
    let paidLeaves = 0;
    let unpaidLeaves = 0;
    let holidayCount = 0;
    let weekOffCount = 0;
    let absentDays = 0;
    const today = new Date();

    monthDays.forEach(date => {
      if (date > today) return; // Don't count future dates
      const dateStr = format(date, "yyyy-MM-dd");

      // Priority 1: Attendance record exists
      const attendanceRecord = userAttendance.find(r => r.date === dateStr);
      if (attendanceRecord) {
        if (attendanceRecord.status === "half_day") halfDays++;
        else presentDays++;
        return;
      }

      // Priority 2: Approved leave
      const leaveRecord = userLeaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);
      if (leaveRecord) {
        if (leaveRecord.leave_type === "unpaid_leave") unpaidLeaves++;
        else paidLeaves++;
        return;
      }

      // Priority 3: Week-off (Sundays, 2nd/4th Saturdays)
      if (isWeekOff(date)) {
        weekOffCount++;
        return;
      }

      // Priority 4: Company holiday (festivals etc.)
      if (isHoliday(date, userLocation)) {
        holidayCount++;
        return;
      }

      // Otherwise: Absent
      absentDays++;
    });

    // Payable = everything except absent
    const payableDays = presentDays + (halfDays * 0.5) + paidLeaves + unpaidLeaves + holidayCount + weekOffCount;
    
    return {
      presentDays,
      halfDays,
      absentDays,
      totalHours: totalHours.toFixed(2),
      paidLeaves,
      unpaidLeaves,
      holidayCount,
      weekOffCount,
      payableDays: payableDays.toFixed(1),
      avgHours: completedAttendance.length > 0 ? (totalHours / completedAttendance.length).toFixed(2) : "0.00",
    };
  };

  const calculateOverallStats = () => {
    if (!filteredUsers) return null;
    
    const allStats = filteredUsers.map(user => calculateUserStats(user.id, user.location));
    const totalPresent = allStats.reduce((sum, s) => sum + s.presentDays, 0);
    const totalHalfDays = allStats.reduce((sum, s) => sum + s.halfDays, 0);
    const totalAbsent = allStats.reduce((sum, s) => sum + s.absentDays, 0);
    const totalHours = allStats.reduce((sum, s) => sum + parseFloat(s.totalHours), 0);
    const avgAttendance = filteredUsers.length > 0 ? ((totalPresent + totalHalfDays * 0.5) / filteredUsers.length).toFixed(1) : "0.0";
    
    return {
      totalEmployees: filteredUsers.length,
      totalPresent,
      totalHalfDays,
      totalAbsent,
      totalHours: totalHours.toFixed(2),
      avgAttendance,
    };
  };

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchTerm) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter(user => {
      const empCode = user.employee_salary_details?.[0]?.employee_code?.toLowerCase() || "";
      return (
        user.full_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        empCode.includes(term)
      );
    });
  }, [users, searchTerm]);

  const overallStats = calculateOverallStats();

  const exportToCSV = () => {
    if (!filteredUsers) return;
    
    const headers = [
      "Employee Code",
      "Employee Name",
      "Email",
      "Branch",
      "Department",
      "Present Days",
      "Half Days",
      "Absent Days",
      "Paid Leaves",
      "Unpaid Leaves",
      "Holidays",
      "Week-offs",
      "Total Hours",
      "Avg Hours/Day",
      "Payable Days"
    ];
    
    const rows = filteredUsers.map(user => {
      const stats = calculateUserStats(user.id, user.location);
      return [
        user.employee_salary_details?.[0]?.employee_code || "N/A",
        user.full_name || "N/A",
        user.email || "N/A",
        user.location || "N/A",
        user.employee_salary_details?.[0]?.department || "N/A",
        stats.presentDays,
        stats.halfDays,
        stats.absentDays,
        stats.paidLeaves,
        stats.unpaidLeaves,
        stats.holidayCount,
        stats.weekOffCount,
        stats.totalHours,
        stats.avgHours,
        stats.payableDays,
      ];
    });
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${month}.csv`;
    a.click();
  };

  if (!permissions.canViewAttendanceReports) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to view attendance reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = attendanceLoading || leaveLoading;
  const hasError = attendanceError || leaveError;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Reports</h1>
          <p className="text-muted-foreground">View and export monthly attendance data</p>
        </div>
        <Button onClick={exportToCSV} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      {hasError && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">
              ⚠️ Error loading attendance data. Please check console for details.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Loading attendance data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !hasError && (
        <>
          {/* Analytics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats?.totalEmployees || 0}</div>
                <p className="text-xs text-muted-foreground">In selected filters</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats?.avgAttendance || "0.0"}</div>
                <p className="text-xs text-muted-foreground">Days per employee</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats?.totalHours || "0.00"}</div>
                <p className="text-xs text-muted-foreground">Combined hours worked</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overallStats ? 
                    ((overallStats.totalPresent + overallStats.totalHalfDays * 0.5) / 
                    ((overallStats.totalPresent + overallStats.totalHalfDays + overallStats.totalAbsent) || 1) * 100).toFixed(1) 
                    : "0.0"}%
                </div>
                <p className="text-xs text-muted-foreground">Present vs Total days</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Monthly Report
                  </CardTitle>
                  {/* View Toggle */}
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "summary" | "datewise")}>
                    <TabsList>
                      <TabsTrigger value="summary" className="gap-1">
                        <Table2 className="h-4 w-4" />
                        Summary
                      </TabsTrigger>
                      <TabsTrigger value="datewise" className="gap-1">
                        <Grid3X3 className="h-4 w-4" />
                        Date-wise
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Input 
                      type="month" 
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Name, Email or Emp Code"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Team</Label>
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Teams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        {teams?.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Select value={selectedDesignation} onValueChange={setSelectedDesignation}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Designations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Designations</SelectItem>
                        {designations?.map((designation) => (
                          <SelectItem key={designation.id} value={designation.id}>
                            {designation.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSelectedTeam("all");
                        setSelectedDesignation("all");
                        setSearchTerm("");
                      }}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "summary" ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Employee</th>
                        <th className="text-left p-3">Emp Code</th>
                        <th className="text-left p-3">Branch</th>
                        <th className="text-left p-3">Dept</th>
                        <th className="text-right p-3">Present</th>
                        <th className="text-right p-3">Half Days</th>
                        <th className="text-right p-3">Absent</th>
                        <th className="text-right p-3">Paid Leaves</th>
                        <th className="text-right p-3">Unpaid</th>
                        <th className="text-right p-3">Holidays</th>
                        <th className="text-right p-3">Week-offs</th>
                        <th className="text-right p-3">Total Hours</th>
                        <th className="text-right p-3">Avg Hours</th>
                        <th className="text-right p-3 font-bold">Payable Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers?.map((user) => {
                        const stats = calculateUserStats(user.id, user.location);
                        return (
                          <tr key={user.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">
                              <div>
                                <div className="font-semibold">{user.full_name || "N/A"}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </td>
                            <td className="p-3 text-sm">
                              {user.employee_salary_details?.[0]?.employee_code || "-"}
                            </td>
                            <td className="p-3 text-sm">
                              {user.location || "-"}
                            </td>
                            <td className="p-3 text-sm">
                              {user.employee_salary_details?.[0]?.department || "-"}
                            </td>
                            <td className="text-right p-3">{stats.presentDays}</td>
                            <td className="text-right p-3">{stats.halfDays}</td>
                            <td className="text-right p-3">{stats.absentDays}</td>
                            <td className="text-right p-3">{stats.paidLeaves}</td>
                            <td className="text-right p-3">{stats.unpaidLeaves}</td>
                            <td className="text-right p-3">{stats.holidayCount}</td>
                            <td className="text-right p-3">{stats.weekOffCount}</td>
                            <td className="text-right p-3">{stats.totalHours}</td>
                            <td className="text-right p-3">{stats.avgHours}</td>
                            <td className="text-right p-3 font-bold">{stats.payableDays}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!filteredUsers?.length && (
                    <div className="text-center py-8 text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              ) : (
                <AdminDateWiseGrid
                  month={month}
                  users={filteredUsers || []}
                  attendanceRecords={attendanceReport || []}
                  leaveApplications={leaveReport || []}
                  holidays={holidays || []}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
