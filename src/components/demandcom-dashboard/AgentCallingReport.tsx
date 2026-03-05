import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAgentCallingReport, AgentCallReport } from "@/hooks/useAgentCallingReport";
import { Phone, ArrowUpDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentCallingReportProps {
  startDate?: Date;
  endDate?: Date;
  compact?: boolean;
  teamMemberIds?: string[];
}

type SortField = 'name' | 'totalCalls' | 'connectedCalls' | 'avgDuration' | 'target' | 'registrations' | 'targetAchievement' | 'conversionRate' | 'dbUpdates';
type SortDirection = 'asc' | 'desc';

function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function getAchievementColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-600 bg-green-50';
  if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

export function AgentCallingReport({ startDate, endDate, compact = false, teamMemberIds }: AgentCallingReportProps) {
  const [sortField, setSortField] = useState<SortField>('totalCalls');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Use today's date if not provided
  const today = new Date();
  const effectiveStartDate = startDate || today;
  const effectiveEndDate = endDate || today;

  const { data: reportData, isLoading } = useAgentCallingReport({
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    teamMemberIds,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter out agents with no activity (0 calls, 0 registrations, 0 dbUpdates)
  // Even if they have targets, don't show them unless they have actual activity
  const filteredData = (reportData || []).filter(row => 
    row.totalCalls > 0 || row.registrations > 0 || row.dbUpdates > 0
  );

  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    return sortDirection === 'asc' 
      ? (aVal as number) - (bVal as number) 
      : (bVal as number) - (aVal as number);
  });

  // Calculate totals from filtered data
  const totals = sortedData.reduce(
    (acc, row) => ({
      totalCalls: acc.totalCalls + row.totalCalls,
      connectedCalls: acc.connectedCalls + row.connectedCalls,
      totalDuration: acc.totalDuration + (row.avgDuration * row.connectedCalls),
      target: acc.target + row.target,
      registrations: acc.registrations + row.registrations,
      dbUpdates: acc.dbUpdates + row.dbUpdates,
    }),
    { totalCalls: 0, connectedCalls: 0, totalDuration: 0, target: 0, registrations: 0, dbUpdates: 0 }
  );

  const avgDurationTotal = totals.connectedCalls > 0 ? totals.totalDuration / totals.connectedCalls : 0;
  const targetAchievementTotal = totals.target > 0 ? (totals.registrations / totals.target) * 100 : 0;
  const conversionRateTotal = totals.totalCalls > 0 ? (totals.registrations / totals.totalCalls) * 100 : 0;

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto p-0 font-medium hover:bg-transparent",
        compact && "text-xs"
      )}
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className={cn(
        "ml-1",
        sortField === field ? "opacity-100" : "opacity-40",
        compact ? "h-2.5 w-2.5" : "h-3 w-3"
      )} />
    </Button>
  );

  return (
    <TooltipProvider>
      <Card className={cn("border-none shadow-sm h-full flex flex-col", compact && "overflow-hidden")}>
        <CardHeader className={cn(
          "flex flex-row items-center justify-between space-y-0",
          compact ? "py-2 px-3 pb-2" : "pb-4"
        )}>
          <CardTitle className={cn(
            "flex items-center gap-1.5",
            compact ? "text-sm" : "text-lg font-semibold"
          )}>
            <Phone className={cn("text-primary", compact ? "h-4 w-4" : "h-5 w-5")} />
            Agent Performance
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className={cn("text-muted-foreground cursor-help", compact ? "h-3 w-3" : "h-4 w-4")} />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[250px]">
                <p className="text-xs">Shows registrations made <strong>within the selected date range</strong>. For cumulative project totals, see Activity/Project Report.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("flex-1 min-h-0", compact ? "p-0" : "")}>
        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-8 w-full" />
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : sortedData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No calling data for today.
          </div>
        ) : (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className={cn(compact && "text-xs py-1.5 px-2")}>
                    <SortableHeader field="name">Agent</SortableHeader>
                  </TableHead>
                  <TableHead className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    <SortableHeader field="totalCalls">Calls</SortableHeader>
                  </TableHead>
                  <TableHead className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    <SortableHeader field="connectedCalls">Conn.</SortableHeader>
                  </TableHead>
                  {!compact && (
                    <TableHead className="text-center">
                      <SortableHeader field="avgDuration">Avg Dur.</SortableHeader>
                    </TableHead>
                  )}
                  <TableHead className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    <SortableHeader field="target">Daily Target</SortableHeader>
                  </TableHead>
                  <TableHead className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        <SortableHeader field="registrations">Actual</SortableHeader>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Registrations made in selected date range</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    <SortableHeader field="targetAchievement">Ach%</SortableHeader>
                  </TableHead>
                  <TableHead className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    <SortableHeader field="dbUpdates">DB Updates</SortableHeader>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className={cn(
                      "font-medium",
                      compact && "text-xs py-1.5 px-2 max-w-[100px] truncate"
                    )}>{row.name}</TableCell>
                    <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                      {(row.totalCalls ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                      {(row.connectedCalls ?? 0).toLocaleString()}
                    </TableCell>
                    {!compact && (
                      <TableCell className="text-center">{formatDuration(row.avgDuration ?? 0)}</TableCell>
                    )}
                    <TableCell className={cn("text-center text-muted-foreground", compact && "text-xs py-1.5 px-2")}>
                      {(row.target ?? 0) > 0 ? row.target : '-'}
                    </TableCell>
                    <TableCell className={cn("text-center font-semibold", compact && "text-xs py-1.5 px-2")}>
                      {row.registrations ?? 0}
                    </TableCell>
                    <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                      {(row.target ?? 0) > 0 ? (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full font-semibold",
                          getAchievementColor(row.targetAchievement ?? 0),
                          compact ? "text-[10px]" : "text-xs"
                        )}>
                          {(row.targetAchievement ?? 0).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-center font-medium", compact && "text-xs py-1.5 px-2")}>
                      {row.dbUpdates > 0 ? row.dbUpdates : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/30 font-semibold border-t-2">
                  <TableCell className={cn(compact && "text-xs py-1.5 px-2")}>TOTAL</TableCell>
                  <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    {totals.totalCalls.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    {totals.connectedCalls.toLocaleString()}
                  </TableCell>
                  {!compact && (
                    <TableCell className="text-center">{formatDuration(avgDurationTotal)}</TableCell>
                  )}
                  <TableCell className={cn("text-center text-muted-foreground", compact && "text-xs py-1.5 px-2")}>
                    {totals.target > 0 ? totals.target : '-'}
                  </TableCell>
                  <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    {totals.registrations}
                  </TableCell>
                  <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    {totals.target > 0 ? (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-full font-semibold",
                        getAchievementColor(targetAchievementTotal),
                        compact ? "text-[10px]" : "text-xs"
                      )}>
                        {targetAchievementTotal.toFixed(0)}%
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className={cn("text-center", compact && "text-xs py-1.5 px-2")}>
                    {totals.dbUpdates > 0 ? totals.dbUpdates : '-'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
