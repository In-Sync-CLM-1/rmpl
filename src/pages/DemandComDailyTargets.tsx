import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemandComDailyTargets } from "@/hooks/useDemandComDailyTargets";
import { DailyTargetRow } from "@/components/demandcom-dashboard/DailyTargetRow";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function AchievementBadge({ percentage }: { percentage: number }) {
  const colorClass = percentage >= 80 
    ? "bg-green-500/20 text-green-700 dark:text-green-400" 
    : percentage >= 50 
      ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" 
      : "bg-red-500/20 text-red-700 dark:text-red-400";
  
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold", colorClass)}>
      {percentage.toFixed(0)}%
    </span>
  );
}

export default function DemandComDailyTargets() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const targetDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get user roles
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);
      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
    enabled: !!currentUser?.id,
  });

  const {
    teamWithTargets,
    teamLeaderIds,
    totals,
    isLoading,
    upsertTarget,
    isUpdating,
  } = useDemandComDailyTargets(targetDateStr);

  // Check if user can edit targets
  const isAdmin = userRoles?.some(role => 
    ['platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech'].includes(role)
  );
  const isManager = userRoles?.includes('manager');
  const isTeamLeader = teamLeaderIds.includes(currentUser?.id || '');

  const canEditAgent = (agentReportsTo: string | null) => {
    if (isAdmin || isManager) return true;
    if (isTeamLeader && agentReportsTo === currentUser?.id) return true;
    return false;
  };

  const handleTargetChange = (
    userId: string,
    callTarget: number,
    registrationTarget: number,
    databaseUpdateTarget: number
  ) => {
    upsertTarget({ userId, callTarget, registrationTarget, databaseUpdateTarget });
  };

  // Calculate totals for achievement percentages
  const totalCallTarget = totals?.callTarget || 0;
  const totalRegTarget = totals?.regTarget || 0;
  const totalDbUpdateTarget = totals?.dbUpdateTarget || 0;
  const totalCallAchPct = totalCallTarget > 0 ? ((totals?.actualCalls || 0) / totalCallTarget) * 100 : 0;
  const totalRegAchPct = totalRegTarget > 0 ? ((totals?.actualRegistrations || 0) / totalRegTarget) * 100 : 0;
  const totalDbUpdateAchPct = totalDbUpdateTarget > 0 ? ((totals?.actualDatabaseUpdates || 0) / totalDbUpdateTarget) * 100 : 0;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Daily Target vs Achievement</h1>
            <p className="text-sm text-muted-foreground">
              Track daily calling targets and actual achievements for DemandCom team
            </p>
          </div>
          
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[200px] justify-start text-left font-normal h-8",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Target Table */}
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">Team Targets & Achievements</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[200px] border-r py-2 text-xs">Team Member</TableHead>
                    <TableHead colSpan={3} className="text-center bg-amber-500/10 py-2 text-xs">Calls</TableHead>
                    <TableHead colSpan={3} className="text-center bg-purple-500/10 py-2 text-xs border-l">Registrations</TableHead>
                    <TableHead colSpan={3} className="text-center bg-teal-500/10 py-2 text-xs border-l">Database Updates</TableHead>
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="border-r py-1 text-xs"></TableHead>
                    <TableHead className="text-center bg-amber-500/10 py-1 text-xs">Target</TableHead>
                    <TableHead className="text-center bg-amber-500/10 py-1 text-xs">Actual</TableHead>
                    <TableHead className="text-center bg-amber-500/10 py-1 text-xs">Ach%</TableHead>
                    <TableHead className="text-center bg-purple-500/10 py-1 text-xs border-l">Target</TableHead>
                    <TableHead className="text-center bg-purple-500/10 py-1 text-xs">Actual</TableHead>
                    <TableHead className="text-center bg-purple-500/10 py-1 text-xs">Ach%</TableHead>
                    <TableHead className="text-center bg-teal-500/10 py-1 text-xs border-l">Target</TableHead>
                    <TableHead className="text-center bg-teal-500/10 py-1 text-xs">Actual</TableHead>
                    <TableHead className="text-center bg-teal-500/10 py-1 text-xs">Ach%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamWithTargets?.map((team) => (
                    <>
                      {/* Team Leader Row */}
                      <DailyTargetRow
                        key={`tl-${team.teamLeader.id}`}
                        userId={team.teamLeader.id}
                        userName={team.teamLeader.full_name || team.teamLeader.email}
                        isTeamLeader
                        callTarget={0}
                        regTarget={0}
                        dbUpdateTarget={0}
                        actualCalls={0}
                        actualRegistrations={0}
                        actualDatabaseUpdates={0}
                        onTargetChange={handleTargetChange}
                        canEdit={false}
                      />
                      {/* Agent Rows */}
                      {team.agents.map((agent) => (
                        <DailyTargetRow
                          key={`agent-${agent.id}`}
                          userId={agent.id}
                          userName={agent.full_name || agent.email}
                          callTarget={agent.callTarget}
                          regTarget={agent.regTarget}
                          dbUpdateTarget={agent.dbUpdateTarget}
                          actualCalls={agent.achievement?.actualCalls || 0}
                          actualRegistrations={agent.achievement?.actualRegistrations || 0}
                          actualDatabaseUpdates={agent.achievement?.actualDatabaseUpdates || 0}
                          onTargetChange={handleTargetChange}
                          canEdit={canEditAgent(agent.reports_to)}
                          isUpdating={isUpdating}
                          hasAttendance={agent.hasAttendance}
                        />
                      ))}
                    </>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-primary/10 font-bold hover:bg-primary/10">
                    <TableCell className="py-1.5 border-r text-sm">TOTAL</TableCell>
                    <TableCell className="text-center text-sm py-1.5 bg-amber-500/20">{totalCallTarget}</TableCell>
                    <TableCell className="text-center text-sm py-1.5 bg-blue-500/20">{totals?.actualCalls || 0}</TableCell>
                    <TableCell className="text-center py-1.5">
                      {totalCallTarget > 0 ? <AchievementBadge percentage={totalCallAchPct} /> : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm py-1.5 border-l bg-purple-500/20">{totalRegTarget}</TableCell>
                    <TableCell className="text-center text-sm py-1.5 bg-green-500/20">{totals?.actualRegistrations || 0}</TableCell>
                    <TableCell className="text-center py-1.5">
                      {totalRegTarget > 0 ? <AchievementBadge percentage={totalRegAchPct} /> : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm py-1.5 border-l bg-teal-500/20">{totalDbUpdateTarget}</TableCell>
                    <TableCell className="text-center text-sm py-1.5 bg-cyan-500/20">{totals?.actualDatabaseUpdates || 0}</TableCell>
                    <TableCell className="text-center py-1.5">
                      {totalDbUpdateTarget > 0 ? <AchievementBadge percentage={totalDbUpdateAchPct} /> : '-'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
