import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Phone, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyTargetAchievementProps {
  targets: {
    onlineCallTarget: number;
    onlineRegTarget: number;
    offlineCallTarget: number;
    offlineRegTarget: number;
  } | null;
  actuals: {
    totalCalls: number;
    registrations: number;
  };
  dateLabel?: string;
  compact?: boolean;
}

export function DailyTargetAchievement({ targets, actuals, dateLabel, compact = false }: DailyTargetAchievementProps) {
  const totalCallTarget = (targets?.onlineCallTarget || 0) + (targets?.offlineCallTarget || 0);
  const totalRegTarget = (targets?.onlineRegTarget || 0) + (targets?.offlineRegTarget || 0);
  
  const callAchievement = totalCallTarget > 0 
    ? Math.min(100, Math.round((actuals.totalCalls / totalCallTarget) * 100)) 
    : 0;
  const regAchievement = totalRegTarget > 0 
    ? Math.min(100, Math.round((actuals.registrations / totalRegTarget) * 100)) 
    : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTextColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  if (compact) {
    return (
      <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 opacity-[0.07]" />
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-purple-600 rounded-l-xl" />
        <CardHeader className="py-2 px-3 relative">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                <Target className="h-3 w-3" />
              </div>
              Targets
            </span>
            {dateLabel && (
              <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded font-normal">
                {dateLabel}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 relative">
          <div className="grid grid-cols-2 gap-3">
            {/* Calls */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Calls
                </span>
                <span className={cn("font-semibold", getTextColor(callAchievement))}>
                  {callAchievement}%
                </span>
              </div>
              <Progress 
                value={callAchievement} 
                className="h-1.5"
                indicatorClassName={getProgressColor(callAchievement)}
              />
              <div className="text-[10px] text-muted-foreground text-right">
                {actuals.totalCalls} / {totalCallTarget}
              </div>
            </div>
            
            {/* Registrations */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Reg
                </span>
                <span className={cn("font-semibold", getTextColor(regAchievement))}>
                  {regAchievement}%
                </span>
              </div>
              <Progress 
                value={regAchievement} 
                className="h-1.5"
                indicatorClassName={getProgressColor(regAchievement)}
              />
              <div className="text-[10px] text-muted-foreground text-right">
                {actuals.registrations} / {totalRegTarget}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 opacity-[0.07]" />
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-purple-600 rounded-l-xl" />
      <CardHeader className="pb-3 relative">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
              <Target className="h-4 w-4" />
            </div>
            Target Achievement
          </span>
          {dateLabel && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-normal">
              {dateLabel}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calls Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total Calls</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {actuals.totalCalls} / {totalCallTarget}
              </span>
              <span className={cn("text-sm font-bold", getTextColor(callAchievement))}>
                {callAchievement}%
              </span>
            </div>
          </div>
          <Progress 
            value={callAchievement} 
            className="h-2"
            indicatorClassName={getProgressColor(callAchievement)}
          />
        </div>

        {/* Registrations Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Registrations</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {actuals.registrations} / {totalRegTarget}
              </span>
              <span className={cn("text-sm font-bold", getTextColor(regAchievement))}>
                {regAchievement}%
              </span>
            </div>
          </div>
          <Progress 
            value={regAchievement} 
            className="h-2"
            indicatorClassName={getProgressColor(regAchievement)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
