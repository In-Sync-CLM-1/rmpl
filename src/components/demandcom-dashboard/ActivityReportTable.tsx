import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface ActivityReportTableProps {
  data: DemandComDashboardMetrics['activityStats'];
  compact?: boolean;
}

// Status is based on: interested + registered counts (activity), and progress rate
const getStatusBadge = (
  interestedCount: number, 
  registeredCount: number, 
  assignedData: number,
  requiredParticipants: number,
  compact: boolean = false
) => {
  const baseClass = compact ? "text-[10px] px-1.5 py-0" : "";
  const hasActivity = interestedCount > 0 || registeredCount > 0;
  const hasAssignments = assignedData > 0;
  
  // If no assignments and no activity, it's truly not started
  if (!hasAssignments && !hasActivity) {
    return <Badge variant="outline" className={cn("bg-muted text-muted-foreground border-muted-foreground/30", baseClass)}>Not Started</Badge>;
  }
  
  // Has assignments but no activity yet - just started/in progress
  if (!hasActivity) {
    return <Badge className={cn("bg-amber-500 hover:bg-amber-500/90 text-white", baseClass)}>In Progress</Badge>;
  }
  
  // Calculate completion rate against target (if target exists) or assignments
  const targetBase = requiredParticipants > 0 ? requiredParticipants : assignedData;
  const completionRate = targetBase > 0 ? (registeredCount / targetBase) * 100 : 0;
  
  if (completionRate >= 100) {
    return <Badge className={cn("bg-green-600 hover:bg-green-600/90 text-white", baseClass)}>Completed</Badge>;
  }
  if (completionRate >= 50) {
    return <Badge className={cn("bg-emerald-500 hover:bg-emerald-500/90 text-white", baseClass)}>On Track</Badge>;
  }
  if (registeredCount > 0) {
    return <Badge className={cn("bg-blue-500 hover:bg-blue-500/90 text-white", baseClass)}>Active</Badge>;
  }
  // Has interested but no registrations yet
  return <Badge className={cn("bg-sky-500 hover:bg-sky-500/90 text-white", baseClass)}>Engaging</Badge>;
};

export function ActivityReportTable({ data, compact = false }: ActivityReportTableProps) {
  return (
    <TooltipProvider>
      <Card className={cn("border-none shadow-sm h-full flex flex-col", compact && "overflow-hidden")}>
        <CardHeader className={cn(compact ? "py-2 px-3" : "")}>
          <CardTitle className={cn("flex items-center gap-1.5", compact ? "text-sm" : "text-lg font-semibold")}>
            Activity/Project Report
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className={cn("text-muted-foreground cursor-help", compact ? "h-3 w-3" : "h-4 w-4")} />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[250px]">
                <p className="text-xs">Shows <strong>cumulative totals</strong> for each project (all registrations, not filtered by date).</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("flex-1 min-h-0", compact ? "p-0" : "")}>
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(compact && "text-xs py-1.5 px-2")}>Project</TableHead>
                  <TableHead className={cn("text-right", compact && "text-xs py-1.5 px-2")}>Target</TableHead>
                  <TableHead className={cn("text-right", compact && "text-xs py-1.5 px-2")}>Assigned</TableHead>
                  <TableHead className={cn("text-right", compact && "text-xs py-1.5 px-2")}>Int.</TableHead>
                  <TableHead className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">Reg.</TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Total registrations for this project (all time)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className={cn(compact && "text-xs py-1.5 px-2")}>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No projects with requirements
                  </TableCell>
                </TableRow>
              ) : (
                data.map((project, index) => (
                  <TableRow key={index}>
                    <TableCell className={cn("font-medium", compact && "text-xs py-1.5 px-2 max-w-[120px] truncate")}>
                      {project.projectName}
                    </TableCell>
                    <TableCell className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                      {(project.requiredParticipants || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                      {(project.assignedData || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                      <span className="text-green-600 font-medium">{project.interestedCount || 0}</span>
                    </TableCell>
                    <TableCell className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                      <span className="text-blue-600 font-medium">{project.registeredCount || 0}</span>
                    </TableCell>
                    <TableCell className={cn(compact && "py-1.5 px-2")}>
                      {getStatusBadge(
                        project.interestedCount || 0,
                        project.registeredCount || 0,
                        project.assignedData || 0,
                        project.requiredParticipants || 0,
                        compact
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
