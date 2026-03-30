import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trophy,
  Target,
  Zap,
  PhoneOff,
  BarChart3,
  Database,
} from "lucide-react";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";
import { AgentCallReport } from "@/hooks/useAgentCallingReport";

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  type: "success" | "warning" | "danger" | "info" | "neutral";
}

interface DemandComInsightsProps {
  metrics: DemandComDashboardMetrics;
  agentReport: AgentCallReport[] | undefined;
  dailyTargets: { onlineCallTarget: number; onlineRegTarget: number; offlineCallTarget: number; offlineRegTarget: number } | null;
  dateLabel: string;
}

const typeStyles: Record<string, string> = {
  success: "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30 hover:shadow-md hover:-translate-y-0.5",
  warning: "border-amber-200/60 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 hover:shadow-md hover:-translate-y-0.5",
  danger: "border-rose-200/60 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30 hover:shadow-md hover:-translate-y-0.5",
  info: "border-blue-200/60 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30 hover:shadow-md hover:-translate-y-0.5",
  neutral: "border-slate-200/60 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30 hover:shadow-md hover:-translate-y-0.5",
};

const iconStyles: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
  info: "text-blue-600 dark:text-blue-400",
  neutral: "text-slate-600 dark:text-slate-400",
};

export function DemandComInsights({ metrics, agentReport, dailyTargets, dateLabel }: DemandComInsightsProps) {
  const insights = useMemo(() => {
    const result: Insight[] = [];

    const activeAgents = agentReport?.filter(a => a.totalCalls > 0 || a.registrations > 0 || a.dbUpdates > 0) || [];
    const totalCalls = activeAgents.reduce((s, a) => s + a.totalCalls, 0);
    const totalConnected = activeAgents.reduce((s, a) => s + a.connectedCalls, 0);
    const totalRegistrations = activeAgents.reduce((s, a) => s + a.registrations, 0);
    const totalTarget = activeAgents.reduce((s, a) => s + a.target, 0);
    const totalDbUpdates = activeAgents.reduce((s, a) => s + a.dbUpdates, 0);

    // ─── 1. Daily Target Achievement ───
    if (dailyTargets && totalTarget > 0) {
      const achievementPct = totalTarget > 0 ? (totalRegistrations / totalTarget) * 100 : 0;
      if (achievementPct >= 100) {
        result.push({
          icon: <Trophy className="h-4 w-4" />,
          title: "Daily Registration Target Met",
          description: `Team has achieved ${achievementPct.toFixed(0)}% of the daily registration target (${totalRegistrations} of ${totalTarget}). Outstanding execution — target exceeded.`,
          type: "success",
        });
      } else if (achievementPct >= 70) {
        const gap = totalTarget - totalRegistrations;
        result.push({
          icon: <Target className="h-4 w-4" />,
          title: "Registration Target Within Reach",
          description: `${achievementPct.toFixed(0)}% of daily target achieved (${totalRegistrations}/${totalTarget}). Just ${gap} more registration${gap > 1 ? "s" : ""} needed to close the gap.`,
          type: "info",
        });
      } else if (achievementPct > 0) {
        result.push({
          icon: <AlertTriangle className="h-4 w-4" />,
          title: "Registration Target Behind Schedule",
          description: `Only ${achievementPct.toFixed(0)}% of the daily target achieved (${totalRegistrations}/${totalTarget}). ${totalTarget - totalRegistrations} registrations still needed. Consider reallocating agents to high-conversion projects.`,
          type: "danger",
        });
      }
    }

    // ─── 2. Call Connectivity Rate ───
    if (totalCalls > 0) {
      const connectRate = (totalConnected / totalCalls) * 100;
      if (connectRate < 30) {
        result.push({
          icon: <PhoneOff className="h-4 w-4" />,
          title: "Low Call Connectivity",
          description: `Only ${connectRate.toFixed(0)}% of calls are connecting (${totalConnected} of ${totalCalls}). This is below the typical 30% benchmark. Review data quality — stale numbers or wrong time slots may be the cause.`,
          type: "danger",
        });
      } else if (connectRate >= 50) {
        result.push({
          icon: <Zap className="h-4 w-4" />,
          title: "Strong Call Connectivity",
          description: `${connectRate.toFixed(0)}% connectivity rate (${totalConnected} connected of ${totalCalls} calls). Well above average — data quality and timing are working well.`,
          type: "success",
        });
      }
    }

    // ─── 3. Top Performer ───
    if (activeAgents.length >= 2) {
      const sorted = [...activeAgents].sort((a, b) => b.registrations - a.registrations);
      const topAgent = sorted[0];
      if (topAgent.registrations > 0) {
        const topContribPct = totalRegistrations > 0 ? (topAgent.registrations / totalRegistrations) * 100 : 0;
        if (topContribPct > 40 && activeAgents.length >= 3) {
          result.push({
            icon: <Trophy className="h-4 w-4" />,
            title: `${topAgent.name.split(" ")[0]} Leading with ${topAgent.registrations} Registrations`,
            description: `Contributing ${topContribPct.toFixed(0)}% of all registrations. High dependency on one agent — consider sharing their approach with the team to boost overall output.`,
            type: "warning",
          });
        } else if (topAgent.registrations > 0) {
          result.push({
            icon: <Trophy className="h-4 w-4" />,
            title: `Top Performer: ${topAgent.name.split(" ")[0]}`,
            description: `Leading with ${topAgent.registrations} registration${topAgent.registrations > 1 ? "s" : ""}${topAgent.target > 0 ? ` (${topAgent.targetAchievement.toFixed(0)}% of target)` : ""}${topAgent.conversionRate > 0 ? ` at a ${topAgent.conversionRate.toFixed(1)}% conversion rate` : ""}.`,
            type: "success",
          });
        }
      }
    }

    // ─── 4. Agents with Zero Registrations ───
    if (activeAgents.length >= 2) {
      const zeroReg = activeAgents.filter(a => a.registrations === 0 && a.totalCalls > 10);
      if (zeroReg.length > 0) {
        const names = zeroReg.slice(0, 3).map(a => `${a.name.split(" ")[0]} (${a.totalCalls} calls)`);
        result.push({
          icon: <AlertTriangle className="h-4 w-4" />,
          title: `${zeroReg.length} Agent${zeroReg.length > 1 ? "s" : ""} Calling But Not Converting`,
          description: `${names.join(", ")}${zeroReg.length > 3 ? ` +${zeroReg.length - 3} more` : ""} — making calls but zero registrations. May need coaching on pitch, better lead quality, or reassignment to different projects.`,
          type: "warning",
        });
      }
    }

    // ─── 5. Conversion Rate ───
    if (totalCalls > 20 && totalRegistrations > 0) {
      const conversionRate = (totalRegistrations / totalCalls) * 100;
      if (conversionRate >= 5) {
        result.push({
          icon: <TrendingUp className="h-4 w-4" />,
          title: "Healthy Conversion Rate",
          description: `Overall conversion rate is ${conversionRate.toFixed(1)}% (${totalRegistrations} registrations from ${totalCalls} calls). The team is effectively moving leads through the funnel.`,
          type: "success",
        });
      } else if (conversionRate < 2) {
        result.push({
          icon: <TrendingDown className="h-4 w-4" />,
          title: "Conversion Rate Needs Improvement",
          description: `Only ${conversionRate.toFixed(1)}% of calls are converting to registrations. With ${totalCalls} calls made, even a 1% improvement would add ${Math.round(totalCalls * 0.01)} more registrations. Focus on lead quality and call scripts.`,
          type: "danger",
        });
      }
    }

    // ─── 6. Project Status Overview ───
    if (metrics.activityStats.length > 0) {
      const projects = metrics.activityStats;
      const completedProjects = projects.filter(p => p.requiredParticipants > 0 && p.registeredCount >= p.requiredParticipants);
      const criticalProjects = projects.filter(p => {
        if (p.requiredParticipants <= 0) return false;
        const fulfillment = (p.registeredCount / p.requiredParticipants) * 100;
        return fulfillment < 30 && p.assignedData > 0;
      });

      if (completedProjects.length > 0) {
        const names = completedProjects.slice(0, 2).map(p => p.projectName);
        result.push({
          icon: <Target className="h-4 w-4" />,
          title: `${completedProjects.length} Project${completedProjects.length > 1 ? "s" : ""} Fully Staffed`,
          description: `${names.join(", ")}${completedProjects.length > 2 ? ` +${completedProjects.length - 2} more` : ""} — registration targets met. Consider reallocating agents from these projects to ones that need more attention.`,
          type: "success",
        });
      }

      if (criticalProjects.length > 0) {
        const names = criticalProjects.slice(0, 2).map(p => {
          const pct = p.requiredParticipants > 0 ? ((p.registeredCount / p.requiredParticipants) * 100).toFixed(0) : "0";
          return `${p.projectName} (${pct}%)`;
        });
        result.push({
          icon: <AlertTriangle className="h-4 w-4" />,
          title: `${criticalProjects.length} Project${criticalProjects.length > 1 ? "s" : ""} Below 30% Registration`,
          description: `${names.join(", ")}${criticalProjects.length > 2 ? ` +${criticalProjects.length - 2} more` : ""} are critically understaffed. These need priority attention and more data assignment.`,
          type: "danger",
        });
      }
    }

    // ─── 7. Shortage Alert ───
    if (metrics.totalRequirement > 0) {
      const shortage = Math.max(0, metrics.totalRequirement - metrics.registered);
      const shortagePct = parseFloat(metrics.shortagePercentage);
      if (shortagePct > 50) {
        result.push({
          icon: <BarChart3 className="h-4 w-4" />,
          title: `${shortagePct.toFixed(0)}% Registration Shortage`,
          description: `${shortage.toLocaleString()} registrations still needed against a total requirement of ${metrics.totalRequirement.toLocaleString()}. At current pace, consider increasing daily targets or onboarding additional agents.`,
          type: "danger",
        });
      } else if (shortagePct > 0 && shortagePct <= 20) {
        result.push({
          icon: <BarChart3 className="h-4 w-4" />,
          title: "Registration Shortage Nearly Closed",
          description: `Only ${shortage.toLocaleString()} registrations remaining (${shortagePct.toFixed(0)}% shortage). The team is close to fulfilling all project requirements.`,
          type: "info",
        });
      }
    }

    // ─── 8. Data Team Productivity ───
    if (metrics.dataTeamStats.length > 0) {
      const totalRecords = metrics.dataTeamStats.reduce((s, m) => s + m.recordsUpdated, 0);
      const totalOther = metrics.dataTeamStats.reduce((s, m) => s + m.otherFieldsUpdated, 0);
      const activeDataMembers = metrics.dataTeamStats.filter(m => m.recordsUpdated > 0);
      const zeroDataMembers = metrics.dataTeamStats.filter(m => m.recordsUpdated === 0);

      if (totalRecords > 0 && activeDataMembers.length > 0) {
        const avgPerMember = (totalRecords / activeDataMembers.length).toFixed(0);
        result.push({
          icon: <Database className="h-4 w-4" />,
          title: `Data Team: ${totalRecords.toLocaleString()} Records Updated`,
          description: `${activeDataMembers.length} active member${activeDataMembers.length > 1 ? "s" : ""} averaging ${avgPerMember} dispositions each${totalOther > 0 ? `, plus ${totalOther.toLocaleString()} field enrichments` : ""}.${zeroDataMembers.length > 0 ? ` ${zeroDataMembers.length} member${zeroDataMembers.length > 1 ? "s" : ""} with no updates.` : ""}`,
          type: zeroDataMembers.length > 0 ? "warning" : "success",
        });
      }
    }

    return result;
  }, [metrics, agentReport, dailyTargets]);

  if (insights.length === 0) return null;

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md animate-pulse-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold">AI Insights</h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
            {insights.length} insights
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-3 backdrop-blur-sm ${typeStyles[insight.type]} transition-all duration-300`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`mt-0.5 shrink-0 ${iconStyles[insight.type]}`}>
                  {insight.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-xs leading-tight mb-1">{insight.title}</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
