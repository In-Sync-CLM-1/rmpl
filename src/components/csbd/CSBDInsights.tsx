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
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { CSBDMetrics } from "@/hooks/useCSBDMetrics";

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  type: "success" | "warning" | "danger" | "info" | "neutral";
}

interface CSBDInsightsProps {
  metrics: CSBDMetrics[];
  totals: { annual_target: number; ytd_projection: number; ytd_actual: number };
  currentMonthTotal: number;
  currentMonthTargetTotal: number;
  year: number;
  getCurrentMonthData: (member: CSBDMetrics) => { actual: number; projection: number };
}

const typeStyles: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
  warning: "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30",
  danger: "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30",
  info: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30",
  neutral: "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30",
};

const iconStyles: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
  info: "text-blue-600 dark:text-blue-400",
  neutral: "text-slate-600 dark:text-slate-400",
};

export function CSBDInsights({
  metrics,
  totals,
  currentMonthTotal,
  currentMonthTargetTotal,
  year,
  getCurrentMonthData,
}: CSBDInsightsProps) {
  const insights = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];

    const result: Insight[] = [];
    const now = new Date();
    const fiscalStartMonth = 3; // April = month 3 (0-indexed)
    const currentMonth = now.getMonth();
    const monthsElapsed =
      currentMonth >= fiscalStartMonth
        ? currentMonth - fiscalStartMonth + 1
        : currentMonth + 12 - fiscalStartMonth + 1;
    const totalFiscalMonths = 12;
    const yearProgressPct = (monthsElapsed / totalFiscalMonths) * 100;
    const annualAchPct = totals.annual_target > 0 ? (totals.ytd_actual / totals.annual_target) * 100 : 0;
    const monthlyAchPct = currentMonthTargetTotal > 0 ? (currentMonthTotal / currentMonthTargetTotal) * 100 : 0;

    // ─── 1. Year-End Forecast ───
    if (monthsElapsed > 0 && totals.annual_target > 0) {
      const monthlyRunRate = totals.ytd_actual / monthsElapsed;
      const projectedYearEnd = monthlyRunRate * totalFiscalMonths;
      const forecastPct = (projectedYearEnd / totals.annual_target) * 100;
      const gap = totals.annual_target - projectedYearEnd;
      const remainingMonths = totalFiscalMonths - monthsElapsed;

      if (forecastPct >= 100) {
        result.push({
          icon: <TrendingUp className="h-4 w-4" />,
          title: "On Track to Exceed Annual Target",
          description: `At the current run rate of ${monthlyRunRate.toFixed(1)}L/month, the team is projected to close FY${year} at ${projectedYearEnd.toFixed(1)}L (${forecastPct.toFixed(0)}% of target). Strong momentum — keep it going.`,
          type: "success",
        });
      } else if (forecastPct >= 80) {
        const requiredMonthly = remainingMonths > 0 ? gap / remainingMonths : gap;
        result.push({
          icon: <Target className="h-4 w-4" />,
          title: "Close to Annual Target — Needs a Push",
          description: `Current pace projects ${projectedYearEnd.toFixed(1)}L by year-end (${forecastPct.toFixed(0)}% of target). To close the ${gap.toFixed(1)}L gap, the team needs ${requiredMonthly.toFixed(1)}L/month over the next ${remainingMonths} months — up from the ${monthlyRunRate.toFixed(1)}L/month average.`,
          type: "warning",
        });
      } else {
        const requiredMonthly = remainingMonths > 0 ? gap / remainingMonths : gap;
        result.push({
          icon: <AlertTriangle className="h-4 w-4" />,
          title: "Annual Target at Risk",
          description: `At current pace, the team will end at ${projectedYearEnd.toFixed(1)}L — a shortfall of ${gap.toFixed(1)}L (${forecastPct.toFixed(0)}% of target). Closing the gap requires ${requiredMonthly.toFixed(1)}L/month for the remaining ${remainingMonths} months, which is ${((requiredMonthly / monthlyRunRate - 1) * 100).toFixed(0)}% above the current run rate.`,
          type: "danger",
        });
      }
    }

    // ─── 2. Achievement vs Year Progress ───
    if (totals.annual_target > 0) {
      const paceIndex = annualAchPct / yearProgressPct;
      if (paceIndex >= 1.1) {
        result.push({
          icon: <ArrowUpRight className="h-4 w-4" />,
          title: "Ahead of Pace",
          description: `The team has achieved ${annualAchPct.toFixed(1)}% of the annual target with ${yearProgressPct.toFixed(0)}% of the fiscal year elapsed. The team is performing ${((paceIndex - 1) * 100).toFixed(0)}% above the expected pace.`,
          type: "success",
        });
      } else if (paceIndex < 0.8) {
        result.push({
          icon: <ArrowDownRight className="h-4 w-4" />,
          title: "Behind Expected Pace",
          description: `With ${yearProgressPct.toFixed(0)}% of the year gone, achievement stands at ${annualAchPct.toFixed(1)}%. The team is tracking ${((1 - paceIndex) * 100).toFixed(0)}% below the expected pace for this point in the fiscal year.`,
          type: "danger",
        });
      }
    }

    // ─── 3. Top Performers ───
    const topPerformers = metrics
      .filter((m) => m.achievement_percentage >= 80 && m.annual_target > 0)
      .sort((a, b) => b.achievement_percentage - a.achievement_percentage)
      .slice(0, 3);

    if (topPerformers.length > 0) {
      const names = topPerformers.map((m) => `${m.full_name.split(" ")[0]} (${m.achievement_percentage.toFixed(0)}%)`);
      result.push({
        icon: <Trophy className="h-4 w-4" />,
        title: "Top Performers",
        description:
          topPerformers.length === 1
            ? `${names[0]} is leading the team with the highest annual achievement. Recognize and replicate their approach across the team.`
            : `${names.join(", ")} are leading the pack. ${topPerformers.filter((m) => m.achievement_percentage >= 100).length > 0 ? `${topPerformers.filter((m) => m.achievement_percentage >= 100).length} member(s) have already crossed 100%.` : "All are on a strong trajectory to exceed their targets."}`,
        type: "success",
      });
    }

    // ─── 4. Members Needing Attention ───
    const atRisk = metrics
      .filter((m) => m.achievement_percentage < 50 && m.annual_target > 0)
      .sort((a, b) => a.achievement_percentage - b.achievement_percentage);

    if (atRisk.length > 0) {
      const names = atRisk.slice(0, 3).map((m) => `${m.full_name.split(" ")[0]} (${m.achievement_percentage.toFixed(0)}%)`);
      const totalGap = atRisk.reduce((sum, m) => sum + (m.annual_target - m.ytd_actual), 0);
      result.push({
        icon: <AlertTriangle className="h-4 w-4" />,
        title: `${atRisk.length} Member${atRisk.length > 1 ? "s" : ""} Below 50% Achievement`,
        description: `${names.join(", ")}${atRisk.length > 3 ? ` and ${atRisk.length - 3} more` : ""} are significantly behind their annual targets. Combined gap of ${totalGap.toFixed(1)}L. Recommend 1-on-1 pipeline reviews and support plans.`,
        type: "danger",
      });
    }

    // ─── 5. Current Month Momentum ───
    if (currentMonthTargetTotal > 0) {
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthProgressPct = (dayOfMonth / daysInMonth) * 100;
      const monthPaceIndex = monthlyAchPct / monthProgressPct;

      // Count members with zero activity this month
      const zeroThisMonth = metrics.filter((m) => {
        const monthData = getCurrentMonthData(m);
        return monthData.projection > 0 && monthData.actual === 0;
      });

      if (monthPaceIndex >= 1.0 && monthlyAchPct > 0) {
        result.push({
          icon: <Zap className="h-4 w-4" />,
          title: "Strong Month in Progress",
          description: `${monthlyAchPct.toFixed(0)}% of this month's target achieved with ${(100 - monthProgressPct).toFixed(0)}% of the month still remaining. The team is on track for a strong close.`,
          type: "success",
        });
      } else if (zeroThisMonth.length > 0 && dayOfMonth > 10) {
        result.push({
          icon: <AlertTriangle className="h-4 w-4" />,
          title: `${zeroThisMonth.length} Member${zeroThisMonth.length > 1 ? "s" : ""} with No Activity This Month`,
          description: `${zeroThisMonth.slice(0, 3).map((m) => m.full_name.split(" ")[0]).join(", ")}${zeroThisMonth.length > 3 ? ` +${zeroThisMonth.length - 3} more` : ""} have zero actuals despite having projections. With ${daysInMonth - dayOfMonth} days left, immediate attention is needed.`,
          type: "warning",
        });
      }
    }

    // ─── 6. Projection Reliability ───
    if (totals.ytd_projection > 0 && totals.ytd_actual > 0) {
      const projAccuracy = (totals.ytd_actual / totals.ytd_projection) * 100;
      if (projAccuracy > 120) {
        result.push({
          icon: <BarChart3 className="h-4 w-4" />,
          title: "Projections Are Conservative",
          description: `YTD actuals (${totals.ytd_actual.toFixed(1)}L) are ${(projAccuracy - 100).toFixed(0)}% above projections (${totals.ytd_projection.toFixed(1)}L). The team may be under-projecting — encourage more accurate forecasting to improve planning.`,
          type: "info",
        });
      } else if (projAccuracy < 70) {
        result.push({
          icon: <BarChart3 className="h-4 w-4" />,
          title: "Projections Are Over-Optimistic",
          description: `YTD actuals are only ${projAccuracy.toFixed(0)}% of projections. The ${(totals.ytd_projection - totals.ytd_actual).toFixed(1)}L gap suggests the team is over-projecting. Review pipeline quality and probability weighting for more realistic forecasts.`,
          type: "warning",
        });
      } else {
        result.push({
          icon: <BarChart3 className="h-4 w-4" />,
          title: "Projection Accuracy is Healthy",
          description: `YTD actuals are tracking at ${projAccuracy.toFixed(0)}% of projections — within a healthy range. Good forecasting discipline across the team.`,
          type: "info",
        });
      }
    }

    // ─── 7. Team Concentration Risk ───
    if (metrics.length >= 3 && totals.ytd_actual > 0) {
      const sorted = [...metrics].sort((a, b) => b.ytd_actual - a.ytd_actual);
      const topContributor = sorted[0];
      const topContributorPct = (topContributor.ytd_actual / totals.ytd_actual) * 100;
      const topTwoPct = ((sorted[0].ytd_actual + (sorted[1]?.ytd_actual || 0)) / totals.ytd_actual) * 100;

      if (topContributorPct > 40) {
        result.push({
          icon: <TrendingDown className="h-4 w-4" />,
          title: "Revenue Concentration Risk",
          description: `${topContributor.full_name.split(" ")[0]} alone accounts for ${topContributorPct.toFixed(0)}% of total team revenue. High dependency on a single performer — consider strategies to distribute pipeline more evenly.`,
          type: "warning",
        });
      } else if (topTwoPct > 65 && metrics.length >= 4) {
        result.push({
          icon: <TrendingDown className="h-4 w-4" />,
          title: "Top-Heavy Revenue Distribution",
          description: `The top 2 performers contribute ${topTwoPct.toFixed(0)}% of team revenue. A broader contribution base would reduce risk and improve team resilience.`,
          type: "warning",
        });
      }
    }

    return result;
  }, [metrics, totals, currentMonthTotal, currentMonthTargetTotal, year, getCurrentMonthData]);

  if (insights.length === 0) return null;

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-sm sm:text-base font-semibold">AI Insights</h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
            {insights.length} insights
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 sm:p-4 ${typeStyles[insight.type]} transition-colors`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`mt-0.5 shrink-0 ${iconStyles[insight.type]}`}>
                  {insight.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm leading-tight mb-1">{insight.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
