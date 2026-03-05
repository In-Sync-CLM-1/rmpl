import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCallingTeamPerformance, CallingTeamMember } from "@/hooks/useCallingTeamPerformance";
import { Phone, Download } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface CallingTeamPerformanceProps {
  dateRange?: { from: Date | null; to: Date | null };
}

export function CallingTeamPerformance({ dateRange }: CallingTeamPerformanceProps) {
  const { data, isLoading } = useCallingTeamPerformance({
    startDate: dateRange?.from || undefined,
    endDate: dateRange?.to || undefined,
  });

  const handleExport = () => {
    if (!data || data.length === 0) return;

    const headers = [
      'Member Name',
      'Total Calls',
      'Connected Calls',
      'Interested',
      'Registered',
      'Not Interested',
      'Follow Up',
      'Call Back',
      'RNR',
      'Busy',
      'Switched Off',
      'Connected',
      'Company Closed',
      'CPNF',
      'Do Not Call',
      'Duplicate',
      'Fully Validate',
      'IVC',
      'Language Problem',
      'LTO',
      'New Contact Updated',
      'No Response',
      'Partially Validate',
      'Prospect',
      'Wrong Number',
      'Performance'
    ];

    const rows = data.map(member => [
      member.name,
      member.totalCalls,
      member.connectedCalls,
      member.dispositionCounts.interested,
      member.dispositionCounts.registered,
      member.dispositionCounts.notInterested,
      member.dispositionCounts.followUp,
      member.dispositionCounts.callBack,
      member.dispositionCounts.rnr,
      member.dispositionCounts.busy,
      member.dispositionCounts.switchedOff,
      member.dispositionCounts.connected,
      member.dispositionCounts.companyClosed,
      member.dispositionCounts.cpnf,
      member.dispositionCounts.doNotCall,
      member.dispositionCounts.duplicate,
      member.dispositionCounts.fullyValidate,
      member.dispositionCounts.ivc,
      member.dispositionCounts.languageProblem,
      member.dispositionCounts.lto,
      member.dispositionCounts.newContactUpdated,
      member.dispositionCounts.noResponse,
      member.dispositionCounts.partiallyValidate,
      member.dispositionCounts.prospect,
      member.dispositionCounts.wrongNumber,
      member.performance,
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
    link.setAttribute('download', `calling_team_performance_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Calling Team Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Calling Team Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No calling activity found for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  const getPerformanceBadge = (performance: CallingTeamMember['performance']) => {
    switch (performance) {
      case 'High':
        return <Badge className="bg-green-500">High</Badge>;
      case 'Moderate':
        return <Badge className="bg-blue-500">Moderate</Badge>;
      case 'Low':
        return <Badge className="bg-orange-500">Low</Badge>;
      default:
        return <Badge variant="secondary">No Activity</Badge>;
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold">Calling Team Performance</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Member-wise disposition updates from calling activity</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member Name</TableHead>
                <TableHead className="text-right">Calls Made</TableHead>
                <TableHead className="text-center">All Dispositions</TableHead>
                <TableHead>Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-blue-600 font-medium cursor-help">{(member.totalCalls ?? 0).toLocaleString()}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Connected: {(member.connectedCalls ?? 0).toLocaleString()}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {member.dispositionCounts.interested > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                                Interested: {member.dispositionCounts.interested}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Marked as Interested</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.registered > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-300 text-emerald-700">
                                Registered: {member.dispositionCounts.registered}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Marked as Registered</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.notInterested > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-red-50 border-red-300 text-red-700">
                                Not Interested: {member.dispositionCounts.notInterested}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Marked as Not Interested</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.followUp > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-700">
                                Follow Up: {member.dispositionCounts.followUp}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Marked as Follow Up</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.callBack > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-purple-50 border-purple-300 text-purple-700">
                                Call Back: {member.dispositionCounts.callBack}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Marked as Call Back</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.rnr > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-gray-50 border-gray-300 text-gray-700">
                                RNR: {member.dispositionCounts.rnr}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Ringing - No Response</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.busy > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-orange-50 border-orange-300 text-orange-700">
                                Busy: {member.dispositionCounts.busy}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Marked as Busy</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.switchedOff > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-slate-50 border-slate-300 text-slate-700">
                                Switched Off: {member.dispositionCounts.switchedOff}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Phone Switched Off</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.connected > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-teal-50 border-teal-300 text-teal-700">
                                Connected: {member.dispositionCounts.connected}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Call Connected</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.companyClosed > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-rose-50 border-rose-300 text-rose-700">
                                Company Closed: {member.dispositionCounts.companyClosed}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Company Closed</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.cpnf > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-300 text-indigo-700">
                                CPNF: {member.dispositionCounts.cpnf}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Contact Person Not Found</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.doNotCall > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-red-100 border-red-400 text-red-800">
                                DNC: {member.dispositionCounts.doNotCall}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Do Not Call</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.duplicate > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300 text-yellow-700">
                                Duplicate: {member.dispositionCounts.duplicate}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Duplicate Entry</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.fullyValidate > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-emerald-100 border-emerald-400 text-emerald-800">
                                Fully Validate: {member.dispositionCounts.fullyValidate}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Fully Validated</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.ivc > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-pink-50 border-pink-300 text-pink-700">
                                IVC: {member.dispositionCounts.ivc}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Invalid Contact</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.languageProblem > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-violet-50 border-violet-300 text-violet-700">
                                LP: {member.dispositionCounts.languageProblem}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Language Problem</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.lto > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-cyan-50 border-cyan-300 text-cyan-700">
                                LTO: {member.dispositionCounts.lto}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Left the Organization</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.newContactUpdated > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700">
                                NCU: {member.dispositionCounts.newContactUpdated}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>New Contact Updated</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.noResponse > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-stone-50 border-stone-300 text-stone-700">
                                NR: {member.dispositionCounts.noResponse}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>No Response</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.partiallyValidate > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-lime-50 border-lime-300 text-lime-700">
                                Partially Validate: {member.dispositionCounts.partiallyValidate}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Partially Validated</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.prospect > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-sky-50 border-sky-300 text-sky-700">
                                Prospect: {member.dispositionCounts.prospect}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Prospect</p></TooltipContent>
                          </Tooltip>
                        )}
                        {member.dispositionCounts.wrongNumber > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs bg-rose-100 border-rose-400 text-rose-800">
                                Wrong Number: {member.dispositionCounts.wrongNumber}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Wrong Number</p></TooltipContent>
                          </Tooltip>
                        )}
                        {Object.values(member.dispositionCounts).every(v => v === 0) && (
                          <span className="text-xs text-muted-foreground">No dispositions</span>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    {getPerformanceBadge(member.performance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
