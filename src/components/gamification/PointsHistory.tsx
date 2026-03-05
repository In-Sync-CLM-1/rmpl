import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Plus, Minus, Phone, UserCheck, CheckSquare, Bell, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserPoint } from "@/hooks/useUserPoints";
import { format } from "date-fns";

interface PointsHistoryProps {
  points: UserPoint[];
  maxHeight?: string;
}

const ActivityIcon = ({ type }: { type: string }) => {
  const iconClass = "w-4 h-4";
  
  switch (type) {
    case 'call_made':
      return <Phone className={iconClass} />;
    case 'registration':
      return <UserCheck className={iconClass} />;
    case 'task_completed':
      return <CheckSquare className={iconClass} />;
    case 'attendance_signin':
      return <Clock className={iconClass} />;
    case 'announcement_read':
      return <Bell className={iconClass} />;
    case 'target_achieved':
      return <Target className={iconClass} />;
    case 'daily_non_usage':
      return <Minus className={iconClass} />;
    default:
      return <Plus className={iconClass} />;
  }
};

const activityLabels: Record<string, string> = {
  call_made: 'Call Made',
  registration: 'Registration',
  task_completed: 'Task Completed',
  attendance_signin: 'Attendance',
  announcement_read: 'Announcement Read',
  target_achieved: 'Target Achieved',
  daily_non_usage: 'Inactive Day',
  onboarding_completed: 'Onboarding Complete',
};

export function PointsHistory({ points, maxHeight = "400px" }: PointsHistoryProps) {
  // Group by date
  const groupedByDate = points.reduce((acc, point) => {
    const date = format(new Date(point.earned_at), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(point);
    return acc;
  }, {} as Record<string, UserPoint[]>);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5 text-primary" />
          Points History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea style={{ maxHeight }} className="pr-4">
          <div className="space-y-6">
            {Object.entries(groupedByDate).map(([date, datePoints]) => {
              const totalForDay = datePoints.reduce((sum, p) => sum + p.points, 0);
              
              return (
                <div key={date}>
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-card py-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(date), 'EEEE, MMM d')}
                    </span>
                    <Badge 
                      variant={totalForDay >= 0 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {totalForDay > 0 ? '+' : ''}{totalForDay} pts
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {datePoints.map((point) => (
                      <div
                        key={point.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg",
                          point.points >= 0 ? "bg-success-bg/50" : "bg-error-bg/50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          point.points >= 0 ? "bg-success-green/10 text-success-green" : "bg-destructive/10 text-destructive"
                        )}>
                          <ActivityIcon type={point.activity_type} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {activityLabels[point.activity_type] || point.activity_type}
                          </p>
                          {point.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {point.description}
                            </p>
                          )}
                        </div>
                        
                        <div className={cn(
                          "font-bold text-sm",
                          point.points >= 0 ? "text-success-green" : "text-destructive"
                        )}>
                          {point.points > 0 ? '+' : ''}{point.points}
                        </div>
                        
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(point.earned_at), 'HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {points.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No points earned yet</p>
                <p className="text-sm">Complete activities to earn points!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
