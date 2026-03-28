import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";
import {
  CheckCircle2, Clock, AlertTriangle, Zap, TrendingUp, FolderKanban,
  ListTodo, Trophy, Target, Users, Timer, ArrowUp, Flame, Star,
} from "lucide-react";

interface MemberStat {
  user_id: string;
  full_name: string;
  total_tasks: number;
  completed: number;
  in_progress: number;
  pending: number;
  cancelled: number;
  overdue: number;
  on_time: number;
  general_tasks: number;
  project_tasks: number;
  high_priority: number;
  avg_completion_days: number | null;
}

interface TeamSummary {
  total_tasks: number;
  completed: number;
  in_progress: number;
  pending: number;
  overdue: number;
  general_tasks: number;
  project_tasks: number;
}

interface WeeklyTrend {
  week_start: string;
  completed: number;
  created: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const MEMBER_COLORS = [
  { gradient: "from-sky-500 to-blue-600", bg: "from-sky-500/10 to-blue-500/5", ring: "ring-sky-500/20", text: "text-sky-600", bar: "#0ea5e9" },
  { gradient: "from-emerald-500 to-green-600", bg: "from-emerald-500/10 to-green-500/5", ring: "ring-emerald-500/20", text: "text-emerald-600", bar: "#10b981" },
  { gradient: "from-violet-500 to-purple-600", bg: "from-violet-500/10 to-purple-500/5", ring: "ring-violet-500/20", text: "text-violet-600", bar: "#8b5cf6" },
  { gradient: "from-amber-500 to-orange-600", bg: "from-amber-500/10 to-orange-500/5", ring: "ring-amber-500/20", text: "text-amber-600", bar: "#f59e0b" },
  { gradient: "from-rose-500 to-pink-600", bg: "from-rose-500/10 to-pink-500/5", ring: "ring-rose-500/20", text: "text-rose-600", bar: "#f43f5e" },
  { gradient: "from-cyan-500 to-teal-600", bg: "from-cyan-500/10 to-teal-500/5", ring: "ring-cyan-500/20", text: "text-cyan-600", bar: "#06b6d4" },
  { gradient: "from-fuchsia-500 to-pink-600", bg: "from-fuchsia-500/10 to-pink-500/5", ring: "ring-fuchsia-500/20", text: "text-fuchsia-600", bar: "#d946ef" },
  { gradient: "from-indigo-500 to-blue-600", bg: "from-indigo-500/10 to-blue-500/5", ring: "ring-indigo-500/20", text: "text-indigo-600", bar: "#6366f1" },
];

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#6b7280"];

export default function DigicomDashboard() {
  const now = new Date();
  const [monthStart, setMonthStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [monthEnd, setMonthEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["digicom-dashboard", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_digicom_dashboard", {
        p_start_date: monthStart,
        p_end_date: monthEnd,
      });
      if (error) throw error;
      return data as { members: MemberStat[]; team_summary: TeamSummary; weekly_trend: WeeklyTrend[] };
    },
  });

  const members = data?.members || [];
  const summary = data?.team_summary || { total_tasks: 0, completed: 0, in_progress: 0, pending: 0, overdue: 0, general_tasks: 0, project_tasks: 0 };
  const weeklyTrend = data?.weekly_trend || [];

  const completionRate = summary.total_tasks > 0
    ? Math.round((summary.completed / summary.total_tasks) * 100) : 0;

  const topPerformer = members.length > 0 ? members[0] : null;

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    setMonthStart(format(startOfMonth(d), "yyyy-MM-dd"));
    setMonthEnd(format(endOfMonth(d), "yyyy-MM-dd"));
  };

  const statusPieData = [
    { name: "Completed", value: summary.completed },
    { name: "In Progress", value: summary.in_progress },
    { name: "Pending", value: summary.pending },
    { name: "Overdue", value: summary.overdue },
  ].filter(d => d.value > 0);

  const memberComparisonData = members.map((m, i) => ({
    name: m.full_name?.split(" ")[0] || "?",
    Completed: m.completed,
    "In Progress": m.in_progress,
    Pending: m.pending,
    Overdue: m.overdue,
  }));

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden p-5 gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              Digicom
            </span>{" "}
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            {members.length} team member{members.length !== 1 ? "s" : ""} &middot; {format(new Date(monthStart), "MMMM yyyy")}
          </p>
        </div>
        <Input
          type="month"
          value={monthStart.slice(0, 7)}
          onChange={handleMonthChange}
          className="w-44"
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-5">

        {/* KPI Row */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible"
          transition={{ delay: 0, duration: 0.5 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <KpiCard
            label="Total Tasks"
            value={summary.total_tasks}
            icon={ListTodo}
            gradient="from-sky-500/15 via-blue-500/10 to-cyan-500/5"
            border="border-sky-500/30"
            accent="from-sky-500 to-blue-600"
            subtitle={`${summary.general_tasks} general + ${summary.project_tasks} project`}
          />
          <KpiCard
            label="Completed"
            value={summary.completed}
            icon={CheckCircle2}
            gradient="from-emerald-500/15 via-green-500/10 to-teal-500/5"
            border="border-emerald-500/30"
            accent="from-emerald-500 to-green-600"
            subtitle={`${completionRate}% completion rate`}
          />
          <KpiCard
            label="In Progress"
            value={summary.in_progress}
            icon={Zap}
            gradient="from-amber-500/15 via-orange-500/10 to-yellow-500/5"
            border="border-amber-500/30"
            accent="from-amber-500 to-orange-600"
            subtitle="Currently active"
          />
          <KpiCard
            label="Overdue"
            value={summary.overdue}
            icon={AlertTriangle}
            gradient={summary.overdue > 0 ? "from-red-500/15 via-rose-500/10 to-pink-500/5" : "from-emerald-500/15 via-green-500/10 to-teal-500/5"}
            border={summary.overdue > 0 ? "border-red-500/30" : "border-emerald-500/30"}
            accent={summary.overdue > 0 ? "from-red-500 to-rose-600" : "from-emerald-500 to-green-600"}
            subtitle={summary.overdue > 0 ? "Needs attention" : "All on track!"}
          />
        </motion.div>

        {/* Charts Row */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible"
          transition={{ delay: 0.1, duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Member Comparison Bar Chart */}
          <div className="lg:col-span-2 dashboard-card group">
            <div className="dashboard-card-accent bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 animate-gradient-shift" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md">
                  <Target className="h-4 w-4 text-white" />
                </div>
                Member Performance
              </h2>
            </div>
            {memberComparisonData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground">
                <div className="text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  <p className="text-sm">No data yet</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={memberComparisonData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(220,13%,91%)", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="In Progress" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status Pie */}
          <div className="dashboard-card group">
            <div className="dashboard-card-accent bg-gradient-to-r from-emerald-500 via-cyan-400 to-sky-500 animate-gradient-shift" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                Status Split
              </h2>
            </div>
            {statusPieData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground">
                <p className="text-sm">No data</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {statusPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
                      {completionRate}%
                    </text>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {statusPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Weekly Trend */}
        {weeklyTrend.length > 0 && (
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible"
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="dashboard-card group">
              <div className="dashboard-card-accent bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 animate-gradient-shift" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  Weekly Trend
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyTrend.map(w => ({
                  week: `W${format(new Date(w.week_start), "w")}`,
                  Created: w.created,
                  Completed: w.completed,
                }))} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Created" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Top Performer Spotlight + Team Leader Board */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible"
          transition={{ delay: 0.3, duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Top Performer */}
          {topPerformer && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/5 p-6">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 animate-gradient-shift" style={{ backgroundSize: "200% 200%" }} />
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Top Performer</p>
                  <p className="text-xl font-extrabold">{topPerformer.full_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-xl bg-white/50 dark:bg-white/5">
                  <p className="text-2xl font-extrabold text-emerald-600">{topPerformer.completed}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Done</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/50 dark:bg-white/5">
                  <p className="text-2xl font-extrabold text-sky-600">{topPerformer.on_time}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">On Time</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/50 dark:bg-white/5">
                  <p className="text-2xl font-extrabold text-violet-600">{topPerformer.avg_completion_days ?? "-"}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Avg Days</p>
                </div>
              </div>
              <div className="absolute bottom-0 right-0 opacity-[0.06]">
                <Star className="h-28 w-28 -mb-6 -mr-6" />
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="lg:col-span-2 dashboard-card group">
            <div className="dashboard-card-accent bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 animate-gradient-shift" />
            <h2 className="text-base font-bold flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-md">
                <Flame className="h-4 w-4 text-white" />
              </div>
              Team Leaderboard
            </h2>
            {members.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">No members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member, idx) => {
                  const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
                  const pct = member.total_tasks > 0 ? Math.round((member.completed / member.total_tasks) * 100) : 0;
                  return (
                    <div
                      key={member.user_id}
                      className={`flex items-center justify-between p-3 rounded-xl bg-gradient-to-r ${color.bg} border ${color.ring} hover:scale-[1.01] transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white text-xs font-bold shadow-md`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{member.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {member.general_tasks}G + {member.project_tasks}P &middot; {pct}% done
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-0 text-[10px] ring-1 ring-emerald-500/20">
                          {member.completed} done
                        </Badge>
                        {member.overdue > 0 && (
                          <Badge className="bg-red-500/10 text-red-700 border-0 text-[10px] ring-1 ring-red-500/20">
                            {member.overdue} overdue
                          </Badge>
                        )}
                        {member.avg_completion_days != null && (
                          <Badge variant="outline" className="text-[10px]">
                            <Timer className="h-3 w-3 mr-0.5" />
                            {member.avg_completion_days}d avg
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Individual Member Cards */}
        {members.length > 0 && (
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible"
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Individual Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {members.map((member, idx) => {
                const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
                const pct = member.total_tasks > 0 ? Math.round((member.completed / member.total_tasks) * 100) : 0;
                const onTimePct = member.completed > 0 ? Math.round((member.on_time / member.completed) * 100) : 0;
                return (
                  <div
                    key={member.user_id}
                    className={`relative overflow-hidden rounded-2xl border ${color.ring} bg-gradient-to-br ${color.bg} p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color.gradient}`} />
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white font-bold shadow-md`}>
                        {member.full_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{member.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{member.total_tasks} total tasks</p>
                      </div>
                    </div>

                    {/* Completion Progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${color.gradient} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-1.5 rounded-lg bg-white/50 dark:bg-white/5">
                        <p className={`text-lg font-extrabold ${color.text}`}>{member.completed}</p>
                        <p className="text-[9px] text-muted-foreground">Done</p>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/50 dark:bg-white/5">
                        <p className="text-lg font-extrabold text-blue-600">{member.in_progress}</p>
                        <p className="text-[9px] text-muted-foreground">Active</p>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/50 dark:bg-white/5">
                        <p className={`text-lg font-extrabold ${member.overdue > 0 ? "text-red-600" : "text-emerald-600"}`}>{member.overdue}</p>
                        <p className="text-[9px] text-muted-foreground">Overdue</p>
                      </div>
                    </div>

                    {/* Bottom Stats */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ArrowUp className="h-3 w-3 text-emerald-500" />
                        {onTimePct}% on-time
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {member.avg_completion_days ?? "-"}d avg
                      </span>
                      {member.high_priority > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 font-medium">
                          <Flame className="h-3 w-3" />
                          {member.high_priority} critical
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── KPI Card component ──
function KpiCard({ label, value, icon: Icon, gradient, border, accent, subtitle }: {
  label: string; value: number; icon: any; gradient: string; border: string; accent: string; subtitle: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} border ${border} p-5 hover:shadow-xl hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 animate-shimmer`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${accent} shadow-md`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-extrabold">{value.toLocaleString()}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
