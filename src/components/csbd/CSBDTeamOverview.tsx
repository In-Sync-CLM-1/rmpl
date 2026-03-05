import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAllCSBDMetrics, CSBDMetrics } from "@/hooks/useCSBDMetrics";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Eye } from "lucide-react";

interface CSBDTeamOverviewProps {
  fiscalYear: number;
}

export const CSBDTeamOverview = ({ fiscalYear }: CSBDTeamOverviewProps) => {
  const { data: allMetrics, isLoading } = useAllCSBDMetrics(fiscalYear);
  const [selectedMember, setSelectedMember] = useState<CSBDMetrics | null>(null);

  const formatCurrency = (value: number) => {
    return `₹${value.toFixed(2)}L`;
  };

  const getAchievementBadge = (percentage: number) => {
    if (percentage >= 100) {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          {percentage.toFixed(1)}%
        </Badge>
      );
    } else if (percentage >= 80) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">
          {percentage.toFixed(1)}%
        </Badge>
      );
    } else if (percentage >= 50) {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0">
          {percentage.toFixed(1)}%
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-0">
          {percentage.toFixed(1)}%
        </Badge>
      );
    }
  };

  const calculateVarianceFromTarget = (member: CSBDMetrics) => {
    return member.ytd_actual - member.annual_target;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" text="Loading team projections..." />
      </div>
    );
  }

  if (!allMetrics || allMetrics.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No CSBD team members found for FY {fiscalYear}.</p>
        </CardContent>
      </Card>
    );
  }

  // Sort team members by achievement percentage (highest to lowest)
  const sortedMetrics = [...allMetrics].sort((a, b) => 
    b.achievement_percentage - a.achievement_percentage
  );

  // Calculate totals
  const totals = sortedMetrics.reduce((acc, member) => ({
    annual_target: acc.annual_target + member.annual_target,
    ytd_projection: acc.ytd_projection + member.ytd_projection,
    ytd_actual: acc.ytd_actual + member.ytd_actual,
  }), { annual_target: 0, ytd_projection: 0, ytd_actual: 0 });

  const totalVariance = totals.ytd_actual - totals.annual_target;
  const totalAchievement = (totals.ytd_actual / totals.annual_target) * 100;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>CSBD Team Projections Overview</CardTitle>
          <CardDescription>View all CSBD team members' projections and performance for FY {fiscalYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Annual Target</TableHead>
                  <TableHead className="text-right">YTD Projection</TableHead>
                  <TableHead className="text-right">YTD Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-center">Achievement</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Totals Row */}
                <TableRow className="bg-primary/10 hover:bg-primary/15 font-bold border-b-2 border-primary/20">
                  <TableCell className="font-bold text-base">
                    <div>TOTAL</div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-base">{formatCurrency(totals.annual_target)}</TableCell>
                  <TableCell className="text-right font-bold text-base">{formatCurrency(totals.ytd_projection)}</TableCell>
                  <TableCell className="text-right font-bold text-base text-emerald-600">
                    {formatCurrency(totals.ytd_actual)}
                  </TableCell>
                  <TableCell className={`text-right font-bold text-base ${totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {totalVariance >= 0 ? '+' : ''}{formatCurrency(totalVariance)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getAchievementBadge(totalAchievement)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs text-muted-foreground">{sortedMetrics.length} members</span>
                  </TableCell>
                </TableRow>

                {/* Team Members */}
                {sortedMetrics.map((member) => {
                  const varianceFromTarget = calculateVarianceFromTarget(member);
                  
                  return (
                    <TableRow key={member.user_id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div>
                          <div>{member.full_name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(member.annual_target)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(member.ytd_projection)}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(member.ytd_actual)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${varianceFromTarget >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {varianceFromTarget >= 0 ? '+' : ''}{formatCurrency(varianceFromTarget)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getAchievementBadge(member.achievement_percentage)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMember(member)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMember?.full_name} - Monthly Performance
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Annual Target</div>
                  <div className="text-lg font-bold">{formatCurrency(selectedMember.annual_target)}</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">YTD Actual</div>
                  <div className="text-lg font-bold text-emerald-600">{formatCurrency(selectedMember.ytd_actual)}</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">YTD Projection</div>
                  <div className="text-lg font-bold">{formatCurrency(selectedMember.ytd_projection)}</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Achievement</div>
                  <div className="text-lg font-bold">{selectedMember.achievement_percentage.toFixed(1)}%</div>
                </div>
              </div>

              {/* Monthly Performance Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Projection</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMember.monthly_performance.map((month, idx) => {
                      const variance = month.actual - month.projection;
                      const monthDate = new Date(month.month);
                      const currentDate = new Date();
                      
                      const getStatusBadge = () => {
                        if (monthDate > currentDate) {
                          return <Badge variant="outline">⏳ Pending</Badge>;
                        }
                        if (month.actual === 0) {
                          return <Badge variant="outline">⏳ Pending</Badge>;
                        }
                        if (variance > 0) {
                          return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">🟢 Over</Badge>;
                        } else if (variance < -5) {
                          return <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-0">🔴 Under</Badge>;
                        } else {
                          return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">🟡 On Track</Badge>;
                        }
                      };

                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-right">
                            {month.projection > 0 ? formatCurrency(month.projection) : '--'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {month.actual > 0 ? formatCurrency(month.actual) : '--'}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {month.actual > 0 ? `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}` : '--'}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
