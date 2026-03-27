import { Skeleton } from "@/components/ui/skeleton";
import { usePersonalDashboard } from "@/hooks/usePersonalDashboard";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  UserPlus,
  Calendar,
  CalendarDays,
  FolderKanban,
  ListTodo,
  Target,
  Database,
  RefreshCw,
} from "lucide-react";
import {
  KpiCard,
  SectionSkeleton,
  SignInStatusCard,
  YesterdayPerformanceCard,
  WeeklyPerformanceChart,
  MonthlyProgressCard,
  LeaderboardWidget,
  DatabaseStatusCard,
  PendingTasksCard,
  ScheduledCallsCard,
} from "@/components/dashboard/DashboardWidgets";
import { UpcomingActivities } from "@/components/dashboard/UpcomingActivities";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { data, isLoading, refetch } = usePersonalDashboard();
  const navigate = useNavigate();

  if (isLoading || !data) {
    return (
      <div className="h-screen flex flex-col overflow-hidden p-5 gap-5">
        <div className="flex items-center gap-3 shrink-0">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SectionSkeleton key={i} height="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionSkeleton height="h-64" />
          <SectionSkeleton height="h-64" />
        </div>
      </div>
    );
  }

  const firstName = data.userName.split(" ")[0];
  const todayStr = format(new Date(), "EEEE, dd MMMM yyyy");
  const attRate =
    data.attendanceTotalDays > 0
      ? Math.round(
          ((data.attendancePresent + data.attendanceHalfDay * 0.5) /
            data.attendanceTotalDays) *
            100
        )
      : 0;
  const totalLeave = data.leaveBalanceCL + data.leaveBalanceEL;

  return (
    <div className="h-screen flex flex-col overflow-hidden p-5 gap-5">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              {firstName}
            </span>
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </span>
            <span className="text-xs text-muted-foreground">{todayStr}</span>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Scrollable Content ─────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-5">
        {/* Row 1: KPI Cards */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0 }}
        >
          {data.isDemandCom ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Calls Today"
                value={data.callsToday}
                target={data.callTargetToday}
                colorClass="from-sky-500/10 to-sky-500/5"
                borderClass="border-sky-500/20"
                shadowClass="hover:shadow-sky-500/10"
                icon={Phone}
                bgIcon={Phone}
              />
              <KpiCard
                label="Registrations"
                value={data.registrationsToday}
                target={data.regTargetToday}
                colorClass="from-emerald-500/10 to-emerald-500/5"
                borderClass="border-emerald-500/20"
                shadowClass="hover:shadow-emerald-500/10"
                icon={UserPlus}
                bgIcon={UserPlus}
              />
              <KpiCard
                label="Attendance"
                value={attRate}
                suffix="%"
                prev={data.prevAttendanceRate}
                colorClass="from-amber-500/10 to-amber-500/5"
                borderClass="border-amber-500/20"
                shadowClass="hover:shadow-amber-500/10"
                icon={Calendar}
                bgIcon={Calendar}
                subtitle={`${data.attendancePresent}P / ${data.attendanceHalfDay}H / ${data.attendanceAbsent}A`}
                onClick={() => navigate("/attendance")}
              />
              <KpiCard
                label="Leave Balance"
                value={totalLeave}
                suffix=" days"
                colorClass="from-violet-500/10 to-violet-500/5"
                borderClass="border-violet-500/20"
                shadowClass="hover:shadow-violet-500/10"
                icon={CalendarDays}
                bgIcon={CalendarDays}
                subtitle={`CL: ${data.leaveBalanceCL} | EL: ${data.leaveBalanceEL}`}
                onClick={() => navigate("/leave-management")}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Projects"
                value={data.totalProjects}
                colorClass="from-sky-500/10 to-sky-500/5"
                borderClass="border-sky-500/20"
                shadowClass="hover:shadow-sky-500/10"
                icon={FolderKanban}
                bgIcon={FolderKanban}
                subtitle={`${data.projectsCompleted} done, ${data.projectsInProgress} active`}
                onClick={() => navigate("/projects")}
              />
              <KpiCard
                label="Tasks Pending"
                value={data.tasksOverdue > 0 ? data.tasksOverdue : data.tasksAssigned - data.tasksCompleted}
                colorClass={
                  data.tasksOverdue > 0
                    ? "from-red-500/10 to-red-500/5"
                    : "from-emerald-500/10 to-emerald-500/5"
                }
                borderClass={
                  data.tasksOverdue > 0
                    ? "border-red-500/20"
                    : "border-emerald-500/20"
                }
                shadowClass={
                  data.tasksOverdue > 0
                    ? "hover:shadow-red-500/10"
                    : "hover:shadow-emerald-500/10"
                }
                icon={ListTodo}
                bgIcon={ListTodo}
                subtitle={
                  data.tasksOverdue > 0
                    ? `${data.tasksOverdue} overdue!`
                    : `${data.tasksCompleted} done this month`
                }
                onClick={() => navigate("/tasks")}
              />
              <KpiCard
                label="Attendance"
                value={attRate}
                suffix="%"
                prev={data.prevAttendanceRate}
                colorClass="from-amber-500/10 to-amber-500/5"
                borderClass="border-amber-500/20"
                shadowClass="hover:shadow-amber-500/10"
                icon={Calendar}
                bgIcon={Calendar}
                subtitle={`${data.attendancePresent}P / ${data.attendanceHalfDay}H / ${data.attendanceAbsent}A`}
                onClick={() => navigate("/attendance")}
              />
              <KpiCard
                label="Leave Balance"
                value={totalLeave}
                suffix=" days"
                colorClass="from-violet-500/10 to-violet-500/5"
                borderClass="border-violet-500/20"
                shadowClass="hover:shadow-violet-500/10"
                icon={CalendarDays}
                bgIcon={CalendarDays}
                subtitle={`CL: ${data.leaveBalanceCL} | EL: ${data.leaveBalanceEL}`}
                onClick={() => navigate("/leave-management")}
              />
            </div>
          )}
        </motion.div>

        {/* Row 2: Yesterday + Sign-in (DemandCom) / Sign-in + Scheduled Calls (others) */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {data.isDemandCom ? (
            <>
              <YesterdayPerformanceCard data={data} />
              <SignInStatusCard data={data} />
            </>
          ) : (
            <>
              <SignInStatusCard data={data} />
              <UpcomingActivities />
            </>
          )}
        </motion.div>

        {/* Row 3: Weekly Chart + Monthly Progress (DemandCom) */}
        {data.isDemandCom && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          >
            <div className="lg:col-span-2">
              <WeeklyPerformanceChart data={data} />
            </div>
            <MonthlyProgressCard data={data} />
          </motion.div>
        )}

        {/* Row 4: Database Status + Scheduled Calls (DemandCom) */}
        {data.isDemandCom && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            <DatabaseStatusCard data={data} />
            <ScheduledCallsCard data={data} />
          </motion.div>
        )}

        {/* Row 5: Leaderboard + Activities (DemandCom) / Leaderboard + Monthly (others) */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: data.isDemandCom ? 0.2 : 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <LeaderboardWidget data={data} />
          {data.isDemandCom ? (
            <UpcomingActivities />
          ) : (
            <MonthlyProgressCard data={data} />
          )}
        </motion.div>

        {/* Row 6: Tasks */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: data.isDemandCom ? 0.25 : 0.15 }}
        >
          <PendingTasksCard data={data} />
        </motion.div>
      </div>
    </div>
  );
}
