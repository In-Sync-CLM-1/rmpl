import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { STAR_TIERS } from "@/hooks/useUserPoints";
import { StarBadge } from "./StarBadge";

interface PointsProgressBarProps {
  currentPoints: number;
  currentTier: keyof typeof STAR_TIERS;
  progress: number;
  nextTier: keyof typeof STAR_TIERS | null;
  pointsNeeded: number;
  className?: string;
}

export function PointsProgressBar({
  currentPoints,
  currentTier,
  progress,
  nextTier,
  pointsNeeded,
  className,
}: PointsProgressBarProps) {
  const tierInfo = STAR_TIERS[currentTier];
  const nextTierInfo = nextTier ? STAR_TIERS[nextTier] : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StarBadge tier={currentTier} size="sm" />
          <span className={cn("font-medium text-sm", tierInfo.color)}>
            {tierInfo.label}
          </span>
        </div>
        
        {nextTier && nextTierInfo && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {pointsNeeded} points to
            </span>
            <StarBadge tier={nextTier} size="sm" />
          </div>
        )}
        
        {!nextTier && (
          <span className="text-xs text-purple-500 font-medium">
            Max tier reached! 🎉
          </span>
        )}
      </div>
      
      <div className="relative">
        <Progress 
          value={progress} 
          className={cn(
            "h-3",
            currentTier === 'platinum' && "[&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-pink-500",
            currentTier === 'gold' && "[&>div]:bg-gradient-to-r [&>div]:from-yellow-400 [&>div]:to-amber-500",
            currentTier === 'silver' && "[&>div]:bg-gradient-to-r [&>div]:from-slate-300 [&>div]:to-slate-400",
            currentTier === 'bronze' && "[&>div]:bg-gradient-to-r [&>div]:from-amber-600 [&>div]:to-amber-700",
            currentTier === 'none' && "[&>div]:bg-primary",
          )}
        />
        
        {/* Milestone markers */}
        <div className="absolute inset-0 flex items-center">
          {Object.entries(STAR_TIERS).slice(1).map(([tier, info]) => {
            const position = (info.threshold / 500) * 100;
            if (position > 100) return null;
            
            return (
              <div
                key={tier}
                className={cn(
                  "absolute w-1 h-4 -top-0.5 rounded-full",
                  currentPoints >= info.threshold ? "bg-white" : "bg-muted-foreground/30"
                )}
                style={{ left: `${position}%` }}
              />
            );
          })}
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{currentPoints} points</span>
        <span>{nextTier ? `${STAR_TIERS[nextTier].threshold} points` : '500+ points'}</span>
      </div>
    </div>
  );
}
