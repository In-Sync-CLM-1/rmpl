import { Card, CardContent } from "@/components/ui/card";
import { Phone, Database, TrendingDown, Users } from "lucide-react";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";
import { cn } from "@/lib/utils";

interface DemandComKPICardsProps {
  metrics: DemandComDashboardMetrics;
  dateLabel?: string;
  compact?: boolean;
}

export function DemandComKPICards({ metrics, dateLabel, compact = false }: DemandComKPICardsProps) {
  const kpis = [
    {
      label: "Connected Calls",
      value: metrics.connectedCallsToday.toLocaleString(),
      icon: Phone,
      gradient: "from-blue-500 to-blue-600",
      lightBg: "from-blue-500 to-blue-600",
    },
    {
      label: "Data Updated",
      value: metrics.totalDataUpdated.toLocaleString(),
      icon: Database,
      gradient: "from-emerald-500 to-emerald-600",
      lightBg: "from-emerald-500 to-emerald-600",
    },
    {
      label: "Shortage",
      value: `${metrics.shortagePercentage}%`,
      subtitle: `${metrics.registered.toLocaleString()}/${metrics.totalRequirement.toLocaleString()}`,
      icon: TrendingDown,
      gradient: "from-orange-500 to-orange-600",
      lightBg: "from-orange-500 to-orange-600",
    },
    {
      label: "Assigned",
      value: `${metrics.assignedPercentage}%`,
      subtitle: `${metrics.assignedCount.toLocaleString()}/${metrics.totalCount.toLocaleString()}`,
      icon: Users,
      gradient: "from-teal-500 to-teal-600",
      lightBg: "from-teal-500 to-teal-600",
    },
  ];

  return (
    <div className={cn(
      "grid gap-3",
      compact ? "grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
    )}>
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.07]", kpi.lightBg)} />
          <div className={cn("absolute top-0 left-0 w-1 h-full bg-gradient-to-b rounded-l-xl", kpi.gradient)} />
          <CardContent className={cn("relative", compact ? "p-3" : "p-4")}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn(
                    "text-muted-foreground truncate",
                    compact ? "text-xs" : "text-sm"
                  )}>{kpi.label}</p>
                  {dateLabel && compact && (
                    <span className="text-[10px] text-muted-foreground/70 bg-muted px-1 py-0.5 rounded">
                      {dateLabel}
                    </span>
                  )}
                </div>
                <p className={cn(
                  "font-bold mt-0.5",
                  compact ? "text-lg" : "text-2xl"
                )}>{kpi.value}</p>
                {kpi.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{kpi.subtitle}</p>
                )}
              </div>
              <div className={cn(
                "rounded-xl flex-shrink-0 shadow-md bg-gradient-to-br text-white",
                kpi.gradient,
                compact ? "p-2" : "p-3"
              )}>
                <kpi.icon className={cn(
                  compact ? "h-4 w-4" : "h-5 w-5"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
