import { useState } from "react";
import { CSBDMetrics } from "@/hooks/useCSBDMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Users, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TeamMemberRow } from "./TeamMemberRow";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TeamHierarchyCardProps {
  metrics: CSBDMetrics;
  type: 'manager' | 'individual';
}

const getAchievementColor = (percentage: number) => {
  if (percentage >= 90) return 'text-success';
  if (percentage >= 75) return 'text-success';
  if (percentage >= 60) return 'text-warning';
  return 'text-destructive';
};

export const TeamHierarchyCard = ({ metrics, type }: TeamHierarchyCardProps) => {
  const [isOpen, setIsOpen] = useState(type === 'manager');
  
  const isManager = type === 'manager' && metrics.team_metrics && metrics.team_metrics.length > 0;
  
  // Calculate team totals for managers
  const teamTarget = isManager 
    ? metrics.annual_target + (metrics.team_metrics?.reduce((sum, m) => sum + m.annual_target, 0) || 0)
    : metrics.annual_target;
  
  const teamYTD = isManager
    ? metrics.ytd_actual + (metrics.team_metrics?.reduce((sum, m) => sum + m.ytd_actual, 0) || 0)
    : metrics.ytd_actual;
  
  const teamAchievement = teamTarget > 0 ? (teamYTD / teamTarget) * 100 : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-2 hover:border-primary/50 transition-colors">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{isManager ? '👔' : '👤'}</div>
              <div>
                <CardTitle className="text-lg">
                  {metrics.full_name}
                  {isManager && (
                    <Badge variant="secondary" className="ml-2">
                      <Users className="h-3 w-3 mr-1" />
                      Manager
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{metrics.email}</p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Personal Performance */}
            <div className="rounded-lg bg-card p-4 border">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Personal Performance
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="text-lg font-bold">₹{metrics.annual_target.toFixed(0)}L</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">YTD Actual</p>
                  <p className="text-lg font-bold text-success">₹{metrics.ytd_actual.toFixed(0)}L</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Achievement</p>
                  <p className={`text-lg font-bold ${getAchievementColor(metrics.achievement_percentage)}`}>
                    {metrics.achievement_percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Team Performance (for managers) */}
            {isManager && (
              <>
                <div className="rounded-lg bg-primary/5 p-4 border border-primary/20">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Performance (Self + {metrics.team_metrics?.length} Members)
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Team Target</p>
                      <p className="text-lg font-bold">₹{teamTarget.toFixed(0)}L</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Team YTD</p>
                      <p className="text-lg font-bold text-success">₹{teamYTD.toFixed(0)}L</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Team Achievement</p>
                      <p className={`text-lg font-bold ${getAchievementColor(teamAchievement)}`}>
                        {teamAchievement.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Members ({metrics.team_metrics?.length})
                  </h4>
                  <div className="space-y-2">
                    {metrics.team_metrics?.map((member) => (
                      <TeamMemberRow key={member.user_id} member={member} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
