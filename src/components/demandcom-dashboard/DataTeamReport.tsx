import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";
import { Users, Download } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DataTeamReportProps {
  data: DemandComDashboardMetrics['dataTeamStats'];
  dateRange?: { from: Date | null; to: Date | null };
  compact?: boolean;
}

export function DataTeamReport({ data, dateRange, compact = false }: DataTeamReportProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;

    const headers = [
      'Member Name',
      'Records Updated',
      'Fully Validate',
      'Partially Validate',
      'Company Closed',
      'CPNF',
      'IVC',
      'LTO',
      'Other Fields Updated',
    ];

    const rows = data.map(member => [
      member.name,
      member.recordsUpdated,
      member.dispositionCounts?.fullyValidate || 0,
      member.dispositionCounts?.partiallyValidate || 0,
      member.dispositionCounts?.companyClosed || 0,
      member.dispositionCounts?.cpnf || 0,
      member.dispositionCounts?.ivc || 0,
      member.dispositionCounts?.lto || 0,
      member.otherFieldsUpdated || 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const dateStr = dateRange?.from && dateRange?.to 
      ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
      : format(new Date(), 'yyyy-MM-dd');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `data_team_performance_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!data || data.length === 0) {
    return (
      <Card className="border-none shadow-sm h-full">
        <CardHeader className={cn(compact ? "py-2 px-3" : "")}>
          <div className="flex items-center gap-2">
            <Users className={cn("text-primary", compact ? "h-4 w-4" : "h-5 w-5")} />
            <CardTitle className={cn(compact ? "text-sm" : "text-lg font-semibold")}>
              Data Team Performance
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data team members found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-none shadow-sm h-full flex flex-col", compact && "overflow-hidden")}>
      <CardHeader className={cn(compact ? "py-2 px-3" : "")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className={cn("text-primary", compact ? "h-4 w-4" : "h-5 w-5")} />
            <CardTitle className={cn(compact ? "text-sm" : "text-lg font-semibold")}>
              Data Team Performance
            </CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            className={cn(compact && "h-7 text-xs px-2")}
          >
            <Download className={cn(compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1 min-h-0", compact ? "p-0" : "")}>
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn(compact && "text-xs py-1.5 px-2")}>Member</TableHead>
                <TableHead className={cn("text-right", compact && "text-xs py-1.5 px-2")}>Records</TableHead>
                <TableHead className={cn("text-right", compact && "text-xs py-1.5 px-2")}>Disposition</TableHead>
                <TableHead className={cn("text-right", compact && "text-xs py-1.5 px-2")}>Other</TableHead>
                <TableHead className={cn(compact && "text-xs py-1.5 px-2")}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className={cn(
                    "font-medium",
                    compact && "text-xs py-1.5 px-2 max-w-[100px] truncate"
                  )}>{member.name}</TableCell>
                  <TableCell className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                    <span className="text-blue-600 font-medium">{member.recordsUpdated.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex flex-wrap gap-0.5 justify-end">
                            {member.dispositionCounts?.fullyValidate > 0 && (
                              <Badge variant="outline" className={cn(
                                "bg-green-50 border-green-300 text-green-700",
                                compact ? "text-[9px] px-1 py-0" : "text-xs"
                              )}>
                                FV:{member.dispositionCounts.fullyValidate}
                              </Badge>
                            )}
                            {member.dispositionCounts?.partiallyValidate > 0 && (
                              <Badge variant="outline" className={cn(
                                "bg-emerald-50 border-emerald-300 text-emerald-700",
                                compact ? "text-[9px] px-1 py-0" : "text-xs"
                              )}>
                                PV:{member.dispositionCounts.partiallyValidate}
                              </Badge>
                            )}
                            {member.recordsUpdated === 0 && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1 text-xs">
                            <p>Fully Validate: {member.dispositionCounts?.fullyValidate || 0}</p>
                            <p>Partially Validate: {member.dispositionCounts?.partiallyValidate || 0}</p>
                            <p>Company Closed: {member.dispositionCounts?.companyClosed || 0}</p>
                            <p>CPNF: {member.dispositionCounts?.cpnf || 0}</p>
                            <p>IVC: {member.dispositionCounts?.ivc || 0}</p>
                            <p>LTO: {member.dispositionCounts?.lto || 0}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className={cn("text-right", compact && "text-xs py-1.5 px-2")}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-purple-600 font-medium cursor-help">
                            {member.otherFieldsUpdated?.toLocaleString() || 0}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1 text-xs">
                            <p>Company Info: {member.updatedFields?.companyInfo || 0}</p>
                            <p>Contact Info: {member.updatedFields?.contactInfo || 0}</p>
                            <p>Location Info: {member.updatedFields?.locationInfo || 0}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className={cn(compact && "py-1.5 px-2")}>
                    {member.recordsUpdated === 0 && member.otherFieldsUpdated === 0 ? (
                      <Badge variant="secondary" className={cn(compact && "text-[10px] px-1.5 py-0")}>None</Badge>
                    ) : member.recordsUpdated < 100 ? (
                      <Badge className={cn("bg-orange-500", compact && "text-[10px] px-1.5 py-0")}>Low</Badge>
                    ) : member.recordsUpdated < 500 ? (
                      <Badge className={cn("bg-blue-500", compact && "text-[10px] px-1.5 py-0")}>Med</Badge>
                    ) : (
                      <Badge className={cn("bg-green-500", compact && "text-[10px] px-1.5 py-0")}>High</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
