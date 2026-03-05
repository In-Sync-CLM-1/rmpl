import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  Clock, 
  Target, 
  Phone, 
  Calendar,
  Database,
  Trophy,
  TrendingUp,
  AlertTriangle,
  User,
  CalendarDays,
  FolderKanban,
  ListTodo,
  Briefcase
} from "lucide-react";
import { PersonalDashboardData } from "@/hooks/usePersonalDashboard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WidgetProps {
  data: PersonalDashboardData;
}

// Compact Stats Row - Icon based
export function CompactStatsRow({ data }: WidgetProps) {
  const attendanceRate = data.attendanceThisMonth.totalDays > 0 
    ? Math.round(((data.attendanceThisMonth.present + data.attendanceThisMonth.halfDay * 0.5) / data.attendanceThisMonth.totalDays) * 100)
    : 0;
  const totalLeaveBalance = data.leaveBalance.casualLeave + data.leaveBalance.earnedLeave;

  const stats = [
    {
      icon: FolderKanban,
      label: "Projects",
      value: data.totalProjectsAssigned,
      subtext: `${data.projectsCompleted} done, ${data.projectsInProgress} active`,
    },
    {
      icon: ListTodo,
      label: "Tasks",
      value: data.tasksPending,
      subtext: data.tasksOverdue > 0 
        ? `${data.tasksOverdue} overdue, ${data.tasksCompletedThisMonth} done` 
        : `${data.tasksCompletedThisMonth} done this month`,
      alert: data.tasksOverdue > 0,
    },
    {
      icon: Calendar,
      label: "Attendance",
      value: `${attendanceRate}%`,
      subtext: `${data.attendanceThisMonth.present}P / ${data.attendanceThisMonth.halfDay}H / ${data.attendanceThisMonth.absent}A`,
    },
    {
      icon: CalendarDays,
      label: "Leave Applied",
      value: data.leaveApplied,
      subtext: `Balance: ${totalLeaveBalance} days available`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <TooltipProvider>
        {stats.map((stat) => (
          <Tooltip key={stat.label}>
            <TooltipTrigger asChild>
              <Card className="p-3 cursor-default group transition-all hover:shadow-md bg-card border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <stat.icon className={`h-4 w-4 ${stat.alert ? 'text-destructive' : 'text-foreground'}`} />
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${stat.alert ? 'text-destructive' : 'text-foreground'}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>{stat.subtext}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}

// Projects Widget (kept for backwards compatibility)
export function ProjectsWidget({ data }: WidgetProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Projects
        </CardDescription>
        <CardTitle className="text-2xl font-bold">
          {data.projectsCompleted} <span className="text-sm font-normal text-muted-foreground">completed</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">{data.projectsInProgress} in progress</span>
          <span className="text-muted-foreground">{data.totalProjectsAssigned} total</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Tasks Widget
export function TasksWidget({ data }: WidgetProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Tasks Assigned
        </CardDescription>
        <CardTitle className="text-2xl font-bold">
          {data.tasksPending} <span className="text-sm font-normal text-muted-foreground">pending</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 text-sm">
          {data.tasksOverdue > 0 && (
            <span className="text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {data.tasksOverdue} overdue
            </span>
          )}
          <span className="text-muted-foreground">{data.tasksCompletedThisMonth} done this month</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Attendance Widget
export function AttendanceWidget({ data }: WidgetProps) {
  const attendanceRate = data.attendanceThisMonth.totalDays > 0 
    ? Math.round(((data.attendanceThisMonth.present + data.attendanceThisMonth.halfDay * 0.5) / data.attendanceThisMonth.totalDays) * 100)
    : 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Attendance This Month
        </CardDescription>
        <CardTitle className="text-2xl font-bold">
          {attendanceRate}% <span className="text-sm font-normal text-muted-foreground">rate</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={attendanceRate} className="h-2 mb-2" />
        <div className="flex gap-3 text-xs">
          <span className="text-green-600">{data.attendanceThisMonth.present} present</span>
          <span className="text-yellow-600">{data.attendanceThisMonth.halfDay} half-day</span>
          <span className="text-red-600">{data.attendanceThisMonth.absent} absent</span>
        </div>
        {data.todayAttendance.signedIn && (
          <div className="mt-2 text-xs text-muted-foreground">
            Today: Signed in at {data.todayAttendance.signInTime ? format(new Date(data.todayAttendance.signInTime), 'hh:mm a') : '-'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Leave Balance Widget
export function LeaveWidget({ data }: WidgetProps) {
  const totalAvailable = data.leaveBalance.casualLeave + data.leaveBalance.earnedLeave;
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Leave Balance
        </CardDescription>
        <CardTitle className="text-2xl font-bold">
          {totalAvailable} <span className="text-sm font-normal text-muted-foreground">days available</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-muted rounded">
            <div className="font-semibold">{data.leaveBalance.casualLeave}</div>
            <div className="text-muted-foreground">Casual</div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="font-semibold">{data.leaveBalance.earnedLeave}</div>
            <div className="text-muted-foreground">Earned</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Daily Target Widget
export function DailyTargetWidget({ data }: WidgetProps) {
  const callProgress = data.dailyTarget.callTarget > 0 
    ? Math.min(100, Math.round((data.dailyTarget.callsAchieved / data.dailyTarget.callTarget) * 100))
    : 0;
  const regProgress = data.dailyTarget.registrationTarget > 0
    ? Math.min(100, Math.round((data.dailyTarget.registrationsAchieved / data.dailyTarget.registrationTarget) * 100))
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs font-medium">
          <Target className="h-4 w-4" />
          Today's Target
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Calls</span>
            <span className="font-medium">{data.dailyTarget.callsAchieved} / {data.dailyTarget.callTarget}</span>
          </div>
          <Progress value={callProgress} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Registrations</span>
            <span className="font-medium">{data.dailyTarget.registrationsAchieved} / {data.dailyTarget.registrationTarget}</span>
          </div>
          <Progress value={regProgress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

// Scheduled Calls Widget
export function ScheduledCallsWidget({ data }: WidgetProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs font-medium">
          <Phone className="h-4 w-4" />
          Scheduled Calls Today
        </CardDescription>
        <CardTitle className="text-2xl font-bold">
          {data.scheduledCallsToday}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Follow-up calls scheduled for today
        </p>
      </CardContent>
    </Card>
  );
}

// Database Status Widget
export function DatabaseStatusWidget({ data }: WidgetProps) {
  const touchedRate = data.assignedRecords > 0 
    ? Math.round((data.calledRecords / data.assignedRecords) * 100)
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs font-medium">
          <Database className="h-4 w-4" />
          Assigned Database
        </CardDescription>
        <CardTitle className="text-2xl font-bold">
          {data.assignedRecords.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">records</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={touchedRate} className="h-2 mb-2" />
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="font-semibold">{data.calledRecords}</div>
            <div className="text-muted-foreground">Called</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{data.untouchedRecords}</div>
            <div className="text-muted-foreground">Untouched</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{data.positiveDispositions}</div>
            <div className="text-muted-foreground">Positive</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Calls Chart Widget
export function CallsChartWidget({ data }: WidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          My Calls - Last 7 Days
        </CardTitle>
        <CardDescription className="text-xs">
          Total this month: {data.callsThisMonth} | This week: {data.callsThisWeek}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {data.dailyCallsData.length > 0 ? (
          <ChartContainer 
            config={{ 
              calls: { 
                label: "Calls", 
                color: "hsl(var(--chart-1))" 
              } 
            }}
          >
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.dailyCallsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), 'EEE')}
                  fontSize={11}
                  className="text-muted-foreground"
                />
                <YAxis fontSize={11} className="text-muted-foreground" />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  labelFormatter={(value) => format(new Date(value), 'PPP')}
                />
                <Area 
                  type="monotone" 
                  dataKey="calls" 
                  stroke="hsl(var(--chart-1))" 
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-muted-foreground">
            No calls data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Monthly Target Chart Widget
export function MonthlyTargetWidget({ data }: WidgetProps) {
  const chartData = [
    { name: 'Calls', target: data.monthlyTarget.callTarget, achieved: data.monthlyTarget.callsAchieved },
    { name: 'Registrations', target: data.monthlyTarget.registrationTarget, achieved: data.monthlyTarget.registrationsAchieved },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Monthly Target vs Achievement
        </CardTitle>
        <CardDescription className="text-xs">
          {format(new Date(), 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer 
          config={{ 
            target: { label: "Target", color: "hsl(var(--muted))" },
            achieved: { label: "Achieved", color: "hsl(var(--chart-2))" }
          }}
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" fontSize={11} className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" fontSize={11} width={80} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="target" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="achieved" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Leaderboard Widget
export function LeaderboardWidget({ data }: WidgetProps) {
  const getRankGradient = (index: number) => {
    switch (index) {
      case 0: return 'bg-gradient-to-r from-yellow-50 to-amber-100 dark:from-yellow-950/30 dark:to-amber-950/30 border-l-4 border-l-yellow-400';
      case 1: return 'bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900/30 dark:to-gray-800/30 border-l-4 border-l-slate-400';
      case 2: return 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border-l-4 border-l-orange-400';
      default: return 'bg-muted/30 border-l-4 border-l-muted';
    }
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0: return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-900 shadow-md';
      case 1: return 'bg-gradient-to-br from-slate-300 to-gray-400 text-slate-800 shadow-md';
      case 2: return 'bg-gradient-to-br from-orange-400 to-amber-500 text-orange-900 shadow-md';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Leaderboard - This Month
        </CardTitle>
        <CardDescription className="text-xs">Top 5 performers by registrations</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2">
          {data.leaderboard.map((user, index) => (
            <div 
              key={user.userId} 
              className={`flex items-center justify-between p-2.5 rounded-lg transition-all hover:scale-[1.01] ${getRankGradient(index)}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getRankBadge(index)}`}>
                  {user.rank}
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{user.userName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-sm">
                  {user.registrations} registrations
                </Badge>
                <Badge variant="outline" className="text-cyan-600 border-cyan-300 dark:border-cyan-700 dark:text-cyan-400">
                  {user.calls} calls
                </Badge>
              </div>
            </div>
          ))}
          {data.leaderboard.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No data available yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}