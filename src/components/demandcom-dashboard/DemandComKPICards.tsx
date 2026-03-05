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
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Data Updated",
      value: metrics.totalDataUpdated.toLocaleString(),
      icon: Database,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Shortage",
      value: `${metrics.shortagePercentage}%`,
      subtitle: `${metrics.registered.toLocaleString()}/${metrics.totalRequirement.toLocaleString()}`,
      icon: TrendingDown,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Assigned",
      value: `${metrics.assignedPercentage}%`,
      subtitle: `${metrics.assignedCount.toLocaleString()}/${metrics.totalCount.toLocaleString()}`,
      icon: Users,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
  ];

  return (
    <div className={cn(
      "grid gap-3",
      compact ? "grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
    )}>
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-none shadow-sm">
          <CardContent className={cn(compact ? "p-3" : "p-4")}>
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
                "rounded-lg flex-shrink-0",
                kpi.bgColor,
                compact ? "p-2" : "p-3"
              )}>
                <kpi.icon className={cn(
                  kpi.color,
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
