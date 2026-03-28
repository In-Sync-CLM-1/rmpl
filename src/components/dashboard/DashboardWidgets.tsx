import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format } from "date-fns";
import {
  Phone,
  UserPlus,
  Calendar,
  CalendarDays,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  Trophy,
  Database,
  CheckCircle2,
  AlertTriangle,
  Timer,
  PhoneCall,
  BarChart3,
  User,
  ArrowUp,
  ArrowDown,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type {
  PersonalDashboardData,
  WeeklyDayBreakdown,
  LeaderboardEntry,
} from "@/hooks/usePersonalDashboard";

// ─── Skeleton Loader ──────────────────────────────────
export function SectionSkeleton({ height = "h-48" }: { height?: string }) {
  return <Skeleton className={`w-full rounded-2xl ${height}`} />;
}

// ─── KPI Card (WA-style gradient) ─────────────────────
interface KpiCardProps {
  label: string;
  value: number | string;
  suffix?: string;
  target?: number;
  prev?: number;
  colorClass: string;
  borderClass: string;
  shadowClass: string;
  icon: LucideIcon;
  bgIcon: LucideIcon;
  subtitle?: string;
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  suffix,
  target,
  prev,
  colorClass,
  borderClass,
  shadowClass,
  icon: Icon,
  bgIcon: BgIcon,
  subtitle,
  onClick,
}: KpiCardProps) {
  const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
  const delta =
    prev != null && prev > 0
      ? Math.round(((numValue - prev) / prev) * 100)
      : null;
  const isUp = delta != null && delta >= 0;
  const progressPct =
    target && target > 0
      ? Math.min(100, Math.round((numValue / target) * 100))
      : null;

  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorClass} border ${borderClass} p-5 text-left transition-all duration-300 hover:shadow-xl ${shadowClass} hover:-translate-y-1.5 hover:scale-[1.02] w-full animate-shimmer`}
    >
      {/* Animated top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${borderClass.replace('border-', 'from-').replace('/20', '')} to-transparent animate-border-flow`} style={{ backgroundSize: '200% 100%', animation: 'border-flow 3s linear infinite' }} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <div className={`p-1 rounded-md bg-gradient-to-br ${colorClass} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          {label}
        </span>
        {delta != null && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isUp
                ? "text-emerald-600 bg-emerald-500/15 ring-1 ring-emerald-500/20"
                : "text-red-500 bg-red-500/15 ring-1 ring-red-500/20"
            }`}
          >
            {isUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isUp ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-3xl font-extrabold text-foreground group-hover:scale-105 transition-transform duration-300 origin-left">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {suffix && (
          <span className="text-lg font-bold text-muted-foreground">
            {suffix}
          </span>
        )}
        {target != null && target > 0 && (
          <span className="text-sm text-muted-foreground ml-1">
            / {target.toLocaleString()}
          </span>
        )}
      </div>
      {progressPct != null && (
        <div className="mt-2">
          <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                progressPct >= 100
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                  : progressPct >= 60
                  ? "bg-gradient-to-r from-blue-400 to-primary"
                  : "bg-gradient-to-r from-amber-400 to-orange-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-medium">
            {progressPct}% achieved
          </p>
        </div>
      )}
      {subtitle && !progressPct && (
        <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
      )}
      <div className="absolute bottom-0 right-0 opacity-[0.08] group-hover:opacity-[0.15] transition-all duration-500 group-hover:scale-110">
        <BgIcon className="h-24 w-24 -mb-4 -mr-4 animate-float" />
      </div>
    </button>
  );
}

// ─── Sign-In Status Card ──────────────────────────────
export function SignInStatusCard({ data }: { data: PersonalDashboardData }) {
  const signInFormatted = data.signInTime
    ? format(new Date(data.signInTime), "hh:mm a")
    : null;
  const signOutFormatted = data.signOutTime
    ? format(new Date(data.signOutTime), "hh:mm a")
    : null;
  const hoursTarget = 9;
  const hoursPct = Math.min(
    100,
    Math.round((data.hoursWorkedToday / hoursTarget) * 100)
  );

  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-500 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md">
              <Clock className="h-4 w-4 text-white" />
            </div>
            Today's Sign-in
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            Attendance status
          </p>
        </div>
        {data.signInTime && (
          <Badge
            className={`text-[10px] border-0 font-bold ${
              data.isLate
                ? "bg-gradient-to-r from-red-500/15 to-orange-500/15 text-red-600 ring-1 ring-red-500/20"
                : "bg-gradient-to-r from-emerald-500/15 to-green-500/15 text-emerald-600 ring-1 ring-emerald-500/20"
            }`}
          >
            {data.isLate ? "Late" : "On Time"}
          </Badge>
        )}
      </div>

      {!data.signInTime ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Clock className="h-8 w-8 mb-2 opacity-30 animate-pulse" />
          <p className="text-sm">Not signed in yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/10">
              <p className="text-[11px] text-muted-foreground">Sign In</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {signInFormatted}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/10">
              <p className="text-[11px] text-muted-foreground">Sign Out</p>
              <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                {signOutFormatted || "—"}
              </p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">Hours Worked</span>
              <span className="font-semibold">
                {Number(data.hoursWorkedToday).toFixed(1)}h / {hoursTarget}h
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  hoursPct >= 100
                    ? "bg-gradient-to-r from-emerald-400 to-green-500"
                    : "bg-gradient-to-r from-blue-400 to-cyan-500"
                }`}
                style={{ width: `${hoursPct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Yesterday Performance Card ───────────────────────
export function YesterdayPerformanceCard({
  data,
}: {
  data: PersonalDashboardData;
}) {
  const fmtDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const metrics = [
    {
      label: "Calls",
      value: data.callsYesterday,
      icon: Phone,
      color: "text-sky-600",
      bg: "bg-sky-500/10",
    },
    {
      label: "Registrations",
      value: data.registrationsYesterday,
      icon: UserPlus,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      label: "DB Updates",
      value: data.dbUpdatesYesterday,
      icon: Database,
      color: "text-violet-600",
      bg: "bg-violet-500/10",
    },
  ];

  const derived = [
    {
      label: "Target Achievement",
      value: `${data.targetAchievementYesterday}%`,
      good: data.targetAchievementYesterday >= 80,
    },
    {
      label: "Connected Rate",
      value: `${data.connectedCallRateYesterday}%`,
      good: data.connectedCallRateYesterday >= 50,
    },
    {
      label: "Avg Duration",
      value: fmtDuration(data.avgCallDurationYesterday),
      good: data.avgCallDurationYesterday >= 60,
    },
  ];

  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <Target className="h-4 w-4 text-white" />
            </div>
            Yesterday's Performance
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            How you did yesterday
          </p>
        </div>
        <Badge className="text-[10px] bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-600 border-violet-500/20">
          Yesterday
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`text-center p-3 rounded-xl ${m.bg} border border-border/30 hover:scale-105 transition-transform duration-200`}
          >
            <div
              className={`h-9 w-9 rounded-lg bg-gradient-to-br ${
                m.label === "Calls"
                  ? "from-sky-400 to-blue-600"
                  : m.label === "Registrations"
                  ? "from-emerald-400 to-green-600"
                  : "from-violet-400 to-purple-600"
              } flex items-center justify-center mx-auto mb-2 shadow-md`}
            >
              <m.icon className="h-4 w-4 text-white" />
            </div>
            <p className="text-2xl font-extrabold text-foreground">
              {m.value}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
              {m.label}
            </p>
          </div>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-3" />

      <div className="grid grid-cols-3 gap-3">
        {derived.map((d) => (
          <div key={d.label} className={`text-center p-2 rounded-lg ${d.good ? "bg-emerald-500/5" : "bg-amber-500/5"}`}>
            <p
              className={`text-lg font-bold ${
                d.good ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {d.value}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">{d.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Weekly Performance Chart ─────────────────────────
export function WeeklyPerformanceChart({
  data,
}: {
  data: PersonalDashboardData;
}) {
  const chartData = data.weeklyBreakdown.map((d: WeeklyDayBreakdown) => ({
    day: d.dayName,
    Calls: d.calls,
    Registrations: d.registrations,
    "DB Updates": d.dbUpdates,
  }));

  const hasData = chartData.some(
    (d) => d.Calls > 0 || d.Registrations > 0 || d["DB Updates"] > 0
  );

  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-sky-500 via-emerald-400 to-violet-500 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            Weekly Performance
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            Calls: {data.weeklyCallsAchieved}/{data.weeklyCallTarget} | Regs:{" "}
            {data.weeklyRegsAchieved}/{data.weeklyRegTarget}
          </p>
        </div>
        <Badge className="text-[10px] bg-gradient-to-r from-sky-500/10 to-blue-500/10 text-sky-600 border-sky-500/20">
          This Week
        </Badge>
      </div>
      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">No activity this week</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220,13%,91%)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(220,13%,91%)",
                fontSize: 12,
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Bar
              dataKey="Calls"
              fill="#0ea5e9"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="Registrations"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="DB Updates"
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Monthly Progress Card ────────────────────────────
export function MonthlyProgressCard({
  data,
}: {
  data: PersonalDashboardData;
}) {
  const callPct =
    data.monthlyCallTarget > 0
      ? Math.round((data.monthlyCallsAchieved / data.monthlyCallTarget) * 100)
      : 0;
  const regPct =
    data.monthlyRegTarget > 0
      ? Math.round((data.monthlyRegsAchieved / data.monthlyRegTarget) * 100)
      : 0;
  const attRate =
    data.attendanceTotalDays > 0
      ? Math.round(
          ((data.attendancePresent + data.attendanceHalfDay * 0.5) /
            data.attendanceTotalDays) *
            100
        )
      : 0;

  const donutData = [
    {
      name: "Calls",
      value: Math.min(callPct, 100),
      remainder: Math.max(100 - callPct, 0),
      color: "#0ea5e9",
    },
    {
      name: "Regs",
      value: Math.min(regPct, 100),
      remainder: Math.max(100 - regPct, 0),
      color: "#10b981",
    },
  ];

  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            This Month
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            {format(new Date(), "MMMM yyyy")}
          </p>
        </div>
        {data.leaderboardRank > 0 && (
          <div className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold">#{data.leaderboardRank}</span>
            {data.leaderboardRankChange > 0 && (
              <ArrowUp className="h-3 w-3 text-emerald-500" />
            )}
            {data.leaderboardRankChange < 0 && (
              <ArrowDown className="h-3 w-3 text-red-500" />
            )}
            {data.leaderboardRankChange === 0 && (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Donut charts side by side */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {donutData.map((item) => (
          <div key={item.name} className="text-center">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie
                  data={[
                    { value: item.value },
                    { value: item.remainder },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={42}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill={item.color} />
                  <Cell fill="hsl(220,13%,91%)" />
                </Pie>
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-sm font-bold"
                >
                  {item.value}%
                </text>
              </PieChart>
            </ResponsiveContainer>
            <p className="text-[10px] font-semibold text-muted-foreground -mt-1">
              {item.name}
            </p>
          </div>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-3" />

      {/* Attendance + Late arrivals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/5 to-green-500/5 border border-emerald-500/10">
          <div>
            <p className="text-[11px] text-muted-foreground">Attendance</p>
            <p className="text-lg font-bold">
              {attRate}%{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({data.attendancePresent}P / {data.attendanceHalfDay}H /{" "}
                {data.attendanceAbsent}A)
              </span>
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-sm">
            <Calendar className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10">
          <div>
            <p className="text-[11px] text-muted-foreground">Late Arrivals</p>
            <p className="text-lg font-bold">
              {data.lateArrivals}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                this month
              </span>
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-sm">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
        </div>
        {(data.regularizationPending > 0 ||
          data.regularizationApproved > 0) && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-violet-500/5 to-purple-500/5 border border-violet-500/10">
            <div>
              <p className="text-[11px] text-muted-foreground">
                Regularizations
              </p>
              <p className="text-sm">
                <span className="text-amber-600 font-semibold">
                  {data.regularizationPending} pending
                </span>
                {data.regularizationApproved > 0 && (
                  <span className="text-emerald-600 ml-2">
                    {data.regularizationApproved} approved
                  </span>
                )}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-sm">
              <Timer className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard Widget ───────────────────────────────
export function LeaderboardWidget({
  data,
}: {
  data: PersonalDashboardData;
}) {
  const getRankGradient = (index: number) => {
    switch (index) {
      case 0:
        return "bg-gradient-to-r from-yellow-50 to-amber-100 dark:from-yellow-950/30 dark:to-amber-950/30 border-l-4 border-l-yellow-400";
      case 1:
        return "bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900/30 dark:to-gray-800/30 border-l-4 border-l-slate-400";
      case 2:
        return "bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border-l-4 border-l-orange-400";
      default:
        return "bg-muted/30 border-l-4 border-l-muted";
    }
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return "bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-900 shadow-md";
      case 1:
        return "bg-gradient-to-br from-slate-300 to-gray-400 text-slate-800 shadow-md";
      case 2:
        return "bg-gradient-to-br from-orange-400 to-amber-500 text-orange-900 shadow-md";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-md">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            Leaderboard
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            Top 5 performers by registrations
          </p>
        </div>
        <Badge className="text-[10px] bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-600 border-amber-500/20">
          This Month
        </Badge>
      </div>
      <div className="space-y-2">
        {data.leaderboard.map((user: LeaderboardEntry, index: number) => (
          <div
            key={user.userId}
            className={`flex items-center justify-between p-2.5 rounded-lg transition-all hover:scale-[1.01] ${getRankGradient(
              index
            )}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getRankBadge(
                  index
                )}`}
              >
                {user.rank}
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{user.userName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-sm text-[10px]">
                {user.registrations} regs
              </Badge>
              <Badge
                variant="outline"
                className="text-cyan-600 border-cyan-300 dark:border-cyan-700 dark:text-cyan-400 text-[10px]"
              >
                {user.calls} calls
              </Badge>
            </div>
          </div>
        ))}
        {data.leaderboard.length === 0 && (
          <div className="text-center text-muted-foreground py-6">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No data yet this month</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Database Status Card ─────────────────────────────
export function DatabaseStatusCard({
  data,
}: {
  data: PersonalDashboardData;
}) {
  const touchedRate =
    data.assignedRecords > 0
      ? Math.round((data.calledRecords / data.assignedRecords) * 100)
      : 0;

  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <Database className="h-4 w-4 text-white" />
            </div>
            Database Status
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            Assigned records overview
          </p>
        </div>
      </div>

      <p className="text-3xl font-extrabold text-foreground mb-1">
        {data.assignedRecords.toLocaleString()}
      </p>
      <p className="text-[11px] text-muted-foreground mb-3">
        Total assigned records
      </p>

      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-600 transition-all duration-700 ease-out"
          style={{ width: `${touchedRate}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2.5 rounded-xl bg-gradient-to-br from-sky-500/5 to-blue-500/10 border border-sky-500/10 hover:scale-105 transition-transform duration-200">
          <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
            {data.calledRecords}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium">Called</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/10 border border-amber-500/10 hover:scale-105 transition-transform duration-200">
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {data.untouchedRecords}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium">Untouched</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/5 to-green-500/10 border border-emerald-500/10 hover:scale-105 transition-transform duration-200">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {data.positiveDispositions}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium">Positive</p>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Tasks Card ───────────────────────────────
export function PendingTasksCard({
  data,
}: {
  data: PersonalDashboardData;
}) {
  const priorityColor: Record<string, string> = {
    urgent: "bg-red-500 text-white",
    high: "bg-orange-500/10 text-orange-600",
    medium: "bg-blue-500/10 text-blue-600",
    low: "bg-slate-500/10 text-slate-600",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-700",
    in_progress: "bg-blue-500/10 text-blue-700",
  };

  const isOverdue = (dueDate: string) => {
    const d = new Date(dueDate);
    const now = new Date();
    return d < now && d.toDateString() !== now.toDateString();
  };

  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            My Tasks
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            {data.pendingTasks.length} pending tasks
          </p>
        </div>
        <a
          href="/tasks"
          className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
        >
          View All
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </a>
      </div>

      {data.pendingTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.pendingTasks.map((task) => {
            const overdue = isOverdue(task.dueDate);
            return (
              <a
                key={task.id}
                href={`/tasks?taskId=${task.id}&type=${task.taskType}`}
                className={`flex items-center justify-between p-2.5 rounded-lg transition-colors border-l-3 ${
                  overdue
                    ? "bg-red-50 dark:bg-red-950/30 border-l-red-500 ring-1 ring-red-200 dark:ring-red-800"
                    : "bg-muted/30 hover:bg-muted/50 border-l-violet-400"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {task.taskName}
                  </p>
                  {task.projectName && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {task.projectName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Badge
                    className={`text-[10px] px-1.5 py-0 h-5 border-0 ${
                      priorityColor[task.priority] || priorityColor.medium
                    }`}
                  >
                    {task.priority}
                  </Badge>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 h-5 border-0 ${
                      statusColor[task.status] || statusColor.pending
                    }`}
                  >
                    {task.status.replace("_", " ")}
                  </Badge>
                  <span
                    className={`text-[10px] flex items-center gap-0.5 ${
                      overdue
                        ? "text-red-600 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {overdue ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {format(new Date(task.dueDate), "dd MMM")}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Scheduled Calls Card ─────────────────────────────
export function ScheduledCallsCard({
  data,
}: {
  data: PersonalDashboardData;
}) {
  return (
    <div className="dashboard-card group">
      <div className="dashboard-card-accent bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500 animate-gradient-shift" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
              <PhoneCall className="h-4 w-4 text-white" />
            </div>
            Scheduled Calls
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-10">
            {data.scheduledCallsToday} follow-ups today
          </p>
        </div>
      </div>

      {data.scheduledCallsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Phone className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">No scheduled calls today</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {data.scheduledCallsList.map((call) => (
            <div
              key={call.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-gradient-to-r from-emerald-500/5 to-green-500/5 border border-emerald-500/10 hover:from-emerald-500/10 hover:to-green-500/10 hover:scale-[1.01] transition-all duration-200"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shrink-0 shadow-sm">
                <Phone className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {call.contactName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {call.companyName}
                </p>
              </div>
              {call.scheduledTime && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(call.scheduledTime), "h:mm a")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
