import { cn } from "@/lib/utils";
import { STAR_TIERS } from "@/hooks/useUserPoints";
import { Star, Crown, Award, Medal, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StarBadgeProps {
  tier: keyof typeof STAR_TIERS;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showAnimation?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const iconSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
};

const TierIcon = ({ tier, size }: { tier: keyof typeof STAR_TIERS; size: 'sm' | 'md' | 'lg' }) => {
  const iconClass = cn(iconSizeClasses[size]);
  
  switch (tier) {
    case 'platinum':
      return <Crown className={cn(iconClass, "text-purple-500")} />;
    case 'gold':
      return <Award className={cn(iconClass, "text-yellow-500")} />;
    case 'silver':
      return <Medal className={cn(iconClass, "text-slate-400")} />;
    case 'bronze':
      return <Star className={cn(iconClass, "text-amber-700 fill-amber-700")} />;
    default:
      return <Star className={cn(iconClass, "text-muted-foreground")} />;
  }
};

export function StarBadge({ 
  tier, 
  size = 'md', 
  showLabel = false, 
  showAnimation = false,
  className 
}: StarBadgeProps) {
  const tierInfo = STAR_TIERS[tier];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "relative flex items-center gap-2",
              showAnimation && tier !== 'none' && "animate-pulse",
              className
            )}
          >
            <div 
              className={cn(
                "rounded-full flex items-center justify-center",
                sizeClasses[size],
                tierInfo.bgColor,
                tier === 'platinum' && "ring-2 ring-purple-400 ring-offset-2",
                tier === 'gold' && "ring-2 ring-yellow-400 ring-offset-2",
              )}
            >
              <TierIcon tier={tier} size={size} />
              {tier === 'platinum' && (
                <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-purple-400 animate-pulse" />
              )}
            </div>
            
            {showLabel && (
              <span className={cn("font-medium text-sm", tierInfo.color)}>
                {tierInfo.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{tierInfo.label}</p>
          <p className="text-xs text-muted-foreground">
            {tier === 'none' ? 'Earn 50 points to get Bronze' : `${tierInfo.threshold}+ points`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
