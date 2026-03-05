import { CSBDMetrics } from "@/hooks/useCSBDMetrics";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TeamMemberRowProps {
  member: CSBDMetrics;
}

const getAchievementBadge = (percentage: number) => {
  if (percentage >= 100) {
    return {
      variant: "default" as const,
      className: "bg-emerald-500 hover:bg-emerald-600 text-white border-0",
      text: `${percentage.toFixed(1)}%`,
    };
  }
  if (percentage >= 80) {
    return {
      variant: "default" as const,
      className: "bg-amber-500 hover:bg-amber-600 text-white border-0",
      text: `${percentage.toFixed(1)}%`,
    };
  }
  if (percentage >= 50) {
    return {
      variant: "default" as const,
      className: "bg-orange-500 hover:bg-orange-600 text-white border-0",
      text: `${percentage.toFixed(1)}%`,
    };
  }
  return {
    variant: "destructive" as const,
    className: "bg-rose-500 hover:bg-rose-600 text-white border-0",
    text: `${percentage.toFixed(1)}%`,
  };
};

export const TeamMemberRow = ({ member }: TeamMemberRowProps) => {
  const achievement = member.achievement_percentage;
  const badge = getAchievementBadge(achievement);
  const hasPositiveTrend = member.ytd_actual > member.ytd_projection * 0.9;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">👤 {member.full_name}</span>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          Target: ₹{member.annual_target.toFixed(0)}L | YTD: ₹{member.ytd_actual.toFixed(0)}L
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-2xl font-bold">{achievement.toFixed(1)}%</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {hasPositiveTrend ? (
              <TrendingUp className="h-3 w-3 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-rose-600" />
            )}
            <span>{hasPositiveTrend ? 'Ahead' : 'Behind'}</span>
          </div>
        </div>
        <Badge variant={badge.variant} className={badge.className}>
          {badge.text}
        </Badge>
      </div>
    </div>
  );
};
