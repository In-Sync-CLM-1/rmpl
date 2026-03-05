import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { useDemandComInsights } from "@/hooks/useDemandComInsights";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DemandComInsightsPanelProps {
  metrics: DemandComDashboardMetrics;
  compact?: boolean;
}

export function DemandComInsightsPanel({ metrics, compact = false }: DemandComInsightsPanelProps) {
  const { data: insights, isLoading, refetch, isRefetching } = useDemandComInsights(metrics);

  return (
    <Card className={cn(
      "border-none shadow-sm bg-gradient-to-br from-purple-50 to-blue-50 h-full flex flex-col",
      compact && "max-h-[140px]"
    )}>
      <CardHeader className={cn(compact ? "py-2 px-3" : "")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className={cn("text-purple-600", compact ? "h-4 w-4" : "h-5 w-5")} />
            <CardTitle className={cn(compact ? "text-sm" : "text-lg font-semibold")}>
              AI Insights
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className={cn(compact ? "h-6 w-6 p-0" : "h-8 w-8 p-0")}
          >
            <RefreshCw className={cn(
              isRefetching ? 'animate-spin' : '',
              compact ? "h-3 w-3" : "h-4 w-4"
            )} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1 min-h-0", compact ? "py-0 px-3 pb-2" : "")}>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        ) : (
          <ScrollArea className={cn(compact ? "h-[60px]" : "h-full")}>
            <div className={cn(
              "text-gray-700 whitespace-pre-wrap leading-relaxed",
              compact ? "text-xs" : "text-sm"
            )}>
              {insights || 'Analyzing data...'}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
