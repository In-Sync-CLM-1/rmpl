import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer 
} from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonalDashboard } from "@/hooks/usePersonalDashboard";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  CompactStatsRow,
  DailyTargetWidget,
  ScheduledCallsWidget,
  DatabaseStatusWidget,
  CallsChartWidget,
  MonthlyTargetWidget,
  LeaderboardWidget,
} from "@/components/dashboard/DashboardWidgets";
import { UserTasksTable } from "@/components/dashboard/UserTasksTable";
import { UpcomingActivities } from "@/components/dashboard/UpcomingActivities";
import { Briefcase } from "lucide-react";

interface AdminDashboardStats {
  totalParticipants: number;
  activeProjectsCount: number;
  activeProjectsValue: number;
  totalProjectsCount: number;
  totalProjectsValue: number;
  recordsUpdatedYesterday: number;
  totalCalls: number;
  totalDemandcomRecords: number;
  demandcomUploadedToday: number;
  dailyCallsData: Array<{ date: string; calls: number }>;
  dailyRecordsData: Array<{ date: string; created: number; updated: number }>;
  dailyEmailsData: Array<{ 
    date: string; 
    sent: number; 
    delivered: number; 
    opened: number; 
    clicked: number;
  }>;
  dailyAttendanceData: Array<{
    date: string;
    present: number;
    halfDay: number;
    absent: number;
  }>;
}

const formatToCrores = (value: number): string => {
  const crores = value / 10000000;
  return crores.toFixed(2);
};

export default function Dashboard() {
  const { permissions, userRoles, isLoading: permissionsLoading } = useUserPermissions();
  const { data: personalData, isLoading: personalLoading } = usePersonalDashboard();
  
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");

  const isAdmin = userRoles.some(r => 
    ['platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech'].includes(r)
  );
  const isManager = userRoles.includes('manager');
  const isDemandComTeam = userRoles.some(r => 
    ['demandcom', 'demandcom_agent', 'demandcom_tl', 'demandcom_manager'].includes(r)
  );

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setUserName(data?.full_name || user.email || 'User');
      }
    };
    fetchUserName();
  }, []);

  useEffect(() => {
    if (isAdmin || isManager) {
      fetchAdminDashboardStats();
    } else {
      setAdminLoading(false);
    }
  }, [isAdmin, isManager]);

  const fetchAdminDashboardStats = async () => {
    try {
      setAdminLoading(true);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const { count: totalParticipants } = await supabase
        .from('master')
        .select('*', { count: 'exact', head: true });

      const { data: allProjects } = await supabase
        .from('projects')
        .select('project_value, status');

      const activeProjects = allProjects?.filter(p => p.status !== 'closed_lost') || [];
      const totalProjects = allProjects || [];

      const activeProjectsCount = activeProjects.length;
      const totalProjectsCount = totalProjects.length;

      const activeProjectsValue = activeProjects.reduce((sum, project) => {
        return sum + (Number(project.project_value) || 0);
      }, 0);

      const totalProjectsValue = totalProjects.reduce((sum, project) => {
        return sum + (Number(project.project_value) || 0);
      }, 0);

      const [masterUpdates, demandcomUpdates] = await Promise.all([
        supabase
          .from('master')
          .select('*', { count: 'exact', head: true })
          .gte('updated_at', yesterday.toISOString())
          .lte('updated_at', yesterdayEnd.toISOString()),
        supabase
          .from('demandcom')
          .select('*', { count: 'exact', head: true })
          .gte('updated_at', yesterday.toISOString())
          .lte('updated_at', yesterdayEnd.toISOString())
      ]);

      const recordsUpdatedYesterday = (masterUpdates.count || 0) + (demandcomUpdates.count || 0);

      const { count: totalCalls } = await supabase
        .from('call_logs')
        .select('*', { count: 'exact', head: true });

      const { count: totalDemandcomRecords } = await supabase
        .from('demandcom')
        .select('*', { count: 'exact', head: true });

      const { count: demandcomUploadedToday } = await supabase
        .from('demandcom')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .lte('created_at', todayEnd.toISOString());

      const { data: callsData } = await supabase
        .from('call_logs')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      const callsByDate = new Map<string, number>();
      callsData?.forEach(call => {
        const date = format(new Date(call.created_at), 'yyyy-MM-dd');
        callsByDate.set(date, (callsByDate.get(date) || 0) + 1);
      });

      const { data: dailyRecordsRaw } = await supabase
        .rpc('get_daily_record_counts', { days: 7 });

      const { data: emailsData } = await supabase
        .from('campaign_recipients')
        .select('sent_at, delivered_at, opened_at, clicked_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('sent_at', { ascending: true });

      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('date, status')
        .gte('date', format(sevenDaysAgo, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      const attendanceByDate = new Map<string, { present: number; halfDay: number; absent: number }>();
      attendanceData?.forEach(record => {
        const dateStr = record.date;
        const existing = attendanceByDate.get(dateStr) || { present: 0, halfDay: 0, absent: 0 };
        
        if (record.status === 'present') {
          existing.present += 1;
        } else if (record.status === 'half_day') {
          existing.halfDay += 1;
        } else if (record.status === 'absent') {
          existing.absent += 1;
        }
        
        attendanceByDate.set(dateStr, existing);
      });

      const emailsByDate = new Map<string, { sent: number; delivered: number; opened: number; clicked: number }>();

      emailsData?.forEach(email => {
        if (email.sent_at) {
          const sentDate = format(new Date(email.sent_at), 'yyyy-MM-dd');
          const existing = emailsByDate.get(sentDate) || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
          existing.sent += 1;
          emailsByDate.set(sentDate, existing);
        }
        if (email.delivered_at) {
          const deliveredDate = format(new Date(email.delivered_at), 'yyyy-MM-dd');
          const existing = emailsByDate.get(deliveredDate) || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
          existing.delivered += 1;
          emailsByDate.set(deliveredDate, existing);
        }
        if (email.opened_at) {
          const openedDate = format(new Date(email.opened_at), 'yyyy-MM-dd');
          const existing = emailsByDate.get(openedDate) || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
          existing.opened += 1;
          emailsByDate.set(openedDate, existing);
        }
        if (email.clicked_at) {
          const clickedDate = format(new Date(email.clicked_at), 'yyyy-MM-dd');
          const existing = emailsByDate.get(clickedDate) || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
          existing.clicked += 1;
          emailsByDate.set(clickedDate, existing);
        }
      });

      const dailyRecordsData = dailyRecordsRaw?.map(row => ({
        date: format(new Date(row.date + 'T00:00:00'), 'MMM dd'),
        created: Number(row.created_count),
        updated: Number(row.updated_count)
      })) || [];

      const dailyCallsData: Array<{ date: string; calls: number }> = [];
      const dailyEmailsData: Array<{ date: string; sent: number; delivered: number; opened: number; clicked: number }> = [];
      const dailyAttendanceData: Array<{ date: string; present: number; halfDay: number; absent: number }> = [];
      
      for (let i = 7; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        dailyCallsData.push({
          date: dateStr,
          calls: callsByDate.get(dateStr) || 0
        });
      }

      for (let i = 7; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = format(date, 'yyyy-MM-dd');

        const emailStats = emailsByDate.get(dateStr) || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
        dailyEmailsData.push({
          date: dateStr,
          sent: emailStats.sent,
          delivered: emailStats.delivered,
          opened: emailStats.opened,
          clicked: emailStats.clicked
        });

        const attendanceStats = attendanceByDate.get(dateStr) || { present: 0, halfDay: 0, absent: 0 };
        dailyAttendanceData.push({
          date: dateStr,
          present: attendanceStats.present,
          halfDay: attendanceStats.halfDay,
          absent: attendanceStats.absent
        });
      }

      setAdminStats({
        totalParticipants: totalParticipants || 0,
        activeProjectsCount,
        activeProjectsValue,
        totalProjectsCount,
        totalProjectsValue,
        recordsUpdatedYesterday: recordsUpdatedYesterday || 0,
        totalCalls: totalCalls || 0,
        totalDemandcomRecords: totalDemandcomRecords || 0,
        demandcomUploadedToday: demandcomUploadedToday || 0,
        dailyCallsData,
        dailyRecordsData,
        dailyEmailsData,
        dailyAttendanceData
      });
    } catch (error) {
      console.error('Error fetching admin dashboard stats:', error);
    } finally {
      setAdminLoading(false);
    }
  };

  if (permissionsLoading || personalLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden p-4 gap-4">
      {/* Personal Dashboard Header - Clean style matching Executive Dashboard */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-200 dark:border-emerald-800">
            <Briefcase className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Welcome back, {userName.split(' ')[0]}!</h1>
            <p className="text-xs text-muted-foreground">Your personalized dashboard overview</p>
          </div>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Personal Stats Cards */}
        {personalData && (
          <>
            {/* Compact Stats Row */}
            <CompactStatsRow data={personalData} />

            {isDemandComTeam && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <DailyTargetWidget data={personalData} />
                <ScheduledCallsWidget data={personalData} />
                <DatabaseStatusWidget data={personalData} />
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-medium">Calls Today</CardDescription>
                    <CardTitle className="text-2xl font-bold">{personalData.callsToday}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Week: {personalData.callsThisWeek} | Month: {personalData.callsThisMonth}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Leaderboard + Calls Chart side by side for DemandCom, full width otherwise */}
            {isDemandComTeam ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <LeaderboardWidget data={personalData} />
                <CallsChartWidget data={personalData} />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <LeaderboardWidget data={personalData} />
                <UpcomingActivities />
              </div>
            )}

            {/* Upcoming Activities - only show separately for DemandCom users */}
            {isDemandComTeam && <UpcomingActivities />}

            {/* User Tasks Table */}
            <UserTasksTable />

            {/* Monthly Target - only for demandcom */}
            {isDemandComTeam && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MonthlyTargetWidget data={personalData} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}