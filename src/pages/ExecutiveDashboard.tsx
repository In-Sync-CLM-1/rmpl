import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAllCSBDMetrics, useCSBDMemberProjects, CSBDMetrics } from "@/hooks/useCSBDMetrics";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Settings, Eye, Target, Calendar, Users, IndianRupee, ChevronRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { CSBDInsights } from "@/components/csbd/CSBDInsights";
import { RefreshDataButton } from "@/components/RefreshDataButton";

const ExecutiveDashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const year = 2026;
  const { data: allMetrics, isLoading, error } = useAllCSBDMetrics(year);
  const [canManageTargets, setCanManageTargets] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CSBDMetrics | null>(null);
  const [drilldownMember, setDrilldownMember] = useState<CSBDMetrics | null>(null);
  const { data: memberProjects, isLoading: projectsLoading } = useCSBDMemberProjects(drilldownMember?.user_id ?? null, year);
  const currentMonth = new Date().getMonth();
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  const currentMonthShort = new Date().toLocaleDateString('en-US', { month: 'short' });

  useEffect(() => {
    const checkAccess = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id);

      const userRoles = roles?.map((r) => r.role) || [];
      const allowedRoles = ['admin_administration', 'admin', 'super_admin', 'platform_admin', 'admin_tech'];
      setCanManageTargets(userRoles.some((role) => allowedRoles.includes(role)));
    };

    checkAccess();
  }, []);

  const formatCurrency = (value: number) => value.toFixed(2);

  const getAchievementBadge = (percentage: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1' : 'text-xs';
    if (percentage >= 100) {
      return <Badge className={`bg-emerald-500 hover:bg-emerald-600 text-white border-0 ${sizeClass}`}>{percentage.toFixed(1)}%</Badge>;
    } else if (percentage >= 80) {
      return <Badge className={`bg-amber-500 hover:bg-amber-600 text-white border-0 ${sizeClass}`}>{percentage.toFixed(1)}%</Badge>;
    } else if (percentage >= 50) {
      return <Badge className={`bg-orange-500 hover:bg-orange-600 text-white border-0 ${sizeClass}`}>{percentage.toFixed(1)}%</Badge>;
    }
    return <Badge className={`bg-rose-500 hover:bg-rose-600 text-white border-0 ${sizeClass}`}>{percentage.toFixed(1)}%</Badge>;
  };

  const getCurrentMonthData = (member: CSBDMetrics) => {
    const currentMonthPerf = member.monthly_performance.find((m) => {
      const monthDate = new Date(m.month);
      return monthDate.getMonth() === currentMonth;
    });
    return {
      actual: currentMonthPerf?.actual || 0,
      projection: currentMonthPerf?.projection || 0,
    };
  };

  const { sortedMetrics, totals, currentMonthTotal, currentMonthTargetTotal } = useMemo(() => {
    if (!allMetrics || allMetrics.length === 0) {
      return { sortedMetrics: [], totals: { annual_target: 0, ytd_projection: 0, ytd_actual: 0 }, currentMonthTotal: 0, currentMonthTargetTotal: 0 };
    }

    const sorted = [...allMetrics].sort((a, b) => b.achievement_percentage - a.achievement_percentage);

    const tots = sorted.reduce(
      (acc, member) => ({
        annual_target: acc.annual_target + member.annual_target,
        ytd_projection: acc.ytd_projection + member.ytd_projection,
        ytd_actual: acc.ytd_actual + member.ytd_actual,
      }),
      { annual_target: 0, ytd_projection: 0, ytd_actual: 0 }
    );

    const monthTot = sorted.reduce((sum, m) => sum + getCurrentMonthData(m).actual, 0);
    const monthTargetTot = sorted.reduce((sum, m) => sum + getCurrentMonthData(m).projection, 0);

    return { sortedMetrics: sorted, totals: tots, currentMonthTotal: monthTot, currentMonthTargetTotal: monthTargetTot };
  }, [allMetrics, currentMonth]);

  const totalAnnualAchievement = totals.annual_target > 0 ? (totals.ytd_actual / totals.annual_target) * 100 : 0;
  const totalMonthlyAchievement = currentMonthTargetTotal > 0 ? (currentMonthTotal / currentMonthTargetTotal) * 100 : 0;

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden p-3 sm:p-4 gap-3">
        <Skeleton className="h-8 sm:h-10 w-48 sm:w-64 flex-shrink-0" />
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <Skeleton className="h-20 sm:h-24" />
          <Skeleton className="h-20 sm:h-24" />
          <Skeleton className="h-20 sm:h-24" />
          <Skeleton className="h-20 sm:h-24" />
        </div>
        <Skeleton className="flex-1" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4 gap-3">
        <Target className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {error instanceof Error ? error.message : 'An error occurred while loading metrics. Please try refreshing the page.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden p-3 sm:p-4 gap-3 bg-gradient-to-br from-primary/5 via-accent-purple/5 to-success-green/5">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-md">
            <Target className="h-5 w-5 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold leading-tight truncate">CSBD Executive Dashboard</h1>
            <p className="text-xs text-muted-foreground truncate">CY {year} • All figures in ₹ Lacs</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <RefreshDataButton
            queryKeys={[["all-csbd-metrics"], ["csbd-member-projects"]]}
          />
          {canManageTargets && (
            <Button variant="outline" size="sm" onClick={() => navigate('/csbd-targets')} className="text-xs sm:text-sm glass-card border-border/50">
              <Settings className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manage </span>Targets
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/csbd-projections')} className="text-xs sm:text-sm glass-card border-border/50">
            <TrendingUp className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">My </span>Projections
          </Button>
        </div>
      </div>

      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 flex-shrink-0">
        {/* Annual Section */}
        <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-[0.08]" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600 rounded-l-xl" />
          <CardContent className="p-2.5 sm:p-3 relative">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                <Target className="h-3 w-3" />
              </div>
              <span className="truncate">Annual Target</span>
            </div>
            <div className="text-base sm:text-xl font-bold">{formatCurrency(totals.annual_target)}</div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-[0.08]" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-l-xl" />
          <CardContent className="p-2.5 sm:p-3 relative">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
                <IndianRupee className="h-3 w-3" />
              </div>
              <span className="truncate">YTD Actual</span>
            </div>
            <div className="text-base sm:text-xl font-bold text-emerald-600">{formatCurrency(totals.ytd_actual)}</div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-violet-600 opacity-[0.08]" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-violet-600 rounded-l-xl" />
          <CardContent className="p-2.5 sm:p-3 relative">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm">
                <TrendingUp className="h-3 w-3" />
              </div>
              <span className="truncate">Annual Ach.</span>
            </div>
            <div className="flex items-center">
              {getAchievementBadge(totalAnnualAchievement, 'lg')}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Section */}
        <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-orange-600 opacity-[0.08]" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-orange-600 rounded-l-xl" />
          <CardContent className="p-2.5 sm:p-3 relative">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm">
                <Calendar className="h-3 w-3" />
              </div>
              <span className="truncate">{currentMonthShort} Target</span>
            </div>
            <div className="text-base sm:text-xl font-bold">{formatCurrency(currentMonthTargetTotal)}</div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-cyan-600 opacity-[0.08]" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-cyan-600 rounded-l-xl" />
          <CardContent className="p-2.5 sm:p-3 relative">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-sm">
                <IndianRupee className="h-3 w-3" />
              </div>
              <span className="truncate">{currentMonthShort} Actual</span>
            </div>
            <div className="text-base sm:text-xl font-bold text-cyan-600">{formatCurrency(currentMonthTotal)}</div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-pink-600 opacity-[0.08]" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-500 to-pink-600 rounded-l-xl" />
          <CardContent className="p-2.5 sm:p-3 relative">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-sm">
                <TrendingUp className="h-3 w-3" />
              </div>
              <span className="truncate">{currentMonthShort} Ach.</span>
            </div>
            <div className="flex items-center">
              {getAchievementBadge(totalMonthlyAchievement, 'lg')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - scrollable area with table + insights */}
      <div className="flex-1 overflow-auto min-h-0 space-y-3">
        {/* Mobile Card View for Team Members */}
        {isMobile ? (
          <div className="space-y-2">
            {/* Totals Card */}
            <Card className="border-0 rounded-xl shadow-lg bg-gradient-to-r from-primary/10 to-primary/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-primary/70 rounded-l-xl" />
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">TEAM TOTAL ({sortedMetrics.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Annual</div>
                    <div className="text-sm font-medium">{formatCurrency(totals.annual_target)} target</div>
                    <div className="text-sm font-bold text-emerald-600">{formatCurrency(totals.ytd_actual)} actual</div>
                    <div className="mt-1">{getAchievementBadge(totalAnnualAchievement)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{currentMonthShort}</div>
                    <div className="text-sm font-medium">{formatCurrency(currentMonthTargetTotal)} target</div>
                    <div className="text-sm font-bold text-cyan-600">{formatCurrency(currentMonthTotal)} actual</div>
                    <div className="mt-1">{getAchievementBadge(totalMonthlyAchievement)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Member Cards */}
            {sortedMetrics.map((member) => {
              const currentMonthData = getCurrentMonthData(member);
              const monthlyTarget = currentMonthData.projection;
              const monthlyAchievement = monthlyTarget > 0 ? (currentMonthData.actual / monthlyTarget) * 100 : 0;

              return (
                <Card
                  key={member.user_id}
                  className="border-0 rounded-xl shadow-md cursor-pointer hover:-translate-y-1 hover:shadow-lg active:bg-muted/50 transition-all duration-300"
                  onClick={() => setSelectedMember(member)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-primary truncate">{member.full_name}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div>
                        <div className="text-xs text-muted-foreground">Annual</div>
                        <div className="text-xs">{formatCurrency(member.annual_target)} → <span className="text-blue-600 font-medium underline" onClick={(e) => { e.stopPropagation(); setDrilldownMember(member); }}>{formatCurrency(member.ytd_actual)}</span></div>
                        <div className="mt-1">{getAchievementBadge(member.achievement_percentage)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{currentMonthShort}</div>
                        <div className="text-xs">{formatCurrency(monthlyTarget)} → <span className="text-blue-600 font-medium underline" onClick={(e) => { e.stopPropagation(); setDrilldownMember(member); }}>{formatCurrency(currentMonthData.actual)}</span></div>
                        <div className="mt-1">{getAchievementBadge(monthlyAchievement)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Desktop Table View */
          <Card className="border-0 rounded-xl shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                    <TableHead rowSpan={2} className="text-xs font-semibold border-r align-middle">Member</TableHead>
                    <TableHead colSpan={3} className="text-center text-xs font-semibold bg-blue-50/80 dark:bg-blue-950/30 border-r">
                      Annual ({year})
                    </TableHead>
                    <TableHead colSpan={3} className="text-center text-xs font-semibold bg-orange-50/80 dark:bg-orange-950/30 border-r">
                      {currentMonthName}
                    </TableHead>
                    <TableHead rowSpan={2} className="text-center text-xs font-semibold align-middle">Actions</TableHead>
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-right text-xs bg-blue-50/50 dark:bg-blue-950/20">Target</TableHead>
                    <TableHead className="text-right text-xs bg-blue-50/50 dark:bg-blue-950/20">Actual</TableHead>
                    <TableHead className="text-center text-xs bg-blue-50/50 dark:bg-blue-950/20 border-r">Ach %</TableHead>
                    <TableHead className="text-right text-xs bg-orange-50/50 dark:bg-orange-950/20">Projections</TableHead>
                    <TableHead className="text-right text-xs bg-orange-50/50 dark:bg-orange-950/20">Actual</TableHead>
                    <TableHead className="text-center text-xs bg-orange-50/50 dark:bg-orange-950/20 border-r">Ach %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Totals Row */}
                  <TableRow className="bg-primary/10 hover:bg-primary/15 font-bold border-b-2 border-primary/20">
                    <TableCell className="font-bold text-sm py-2 border-r">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        TOTAL ({sortedMetrics.length})
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm py-2">{formatCurrency(totals.annual_target)}</TableCell>
                    <TableCell className="text-right font-bold text-sm py-2 text-emerald-600">{formatCurrency(totals.ytd_actual)}</TableCell>
                    <TableCell className="text-center py-2 border-r">{getAchievementBadge(totalAnnualAchievement)}</TableCell>
                    <TableCell className="text-right font-bold text-sm py-2">{formatCurrency(currentMonthTargetTotal)}</TableCell>
                    <TableCell className="text-right font-bold text-sm py-2 text-cyan-600">{formatCurrency(currentMonthTotal)}</TableCell>
                    <TableCell className="text-center py-2 border-r">{getAchievementBadge(totalMonthlyAchievement)}</TableCell>
                    <TableCell className="text-center py-2">
                      <span className="text-xs text-muted-foreground">—</span>
                    </TableCell>
                  </TableRow>

                  {/* Team Members */}
                  {sortedMetrics.map((member) => {
                    const currentMonthData = getCurrentMonthData(member);
                    const monthlyTarget = currentMonthData.projection;
                    const monthlyAchievement = monthlyTarget > 0 ? (currentMonthData.actual / monthlyTarget) * 100 : 0;

                    return (
                      <TableRow key={member.user_id} className="hover:bg-muted/50">
                        <TableCell className="py-2 border-r">
                          <div className="font-medium text-sm">{member.full_name}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm py-2">{formatCurrency(member.annual_target)}</TableCell>
                        <TableCell
                          className="text-right text-sm font-medium py-2 text-blue-600 underline cursor-pointer hover:text-blue-800"
                          onClick={() => setDrilldownMember(member)}
                          title="Click to view project breakdown"
                        >
                          {formatCurrency(member.ytd_actual)}
                        </TableCell>
                        <TableCell className="text-center py-2 border-r">{getAchievementBadge(member.achievement_percentage)}</TableCell>
                        <TableCell className="text-right text-sm py-2">{formatCurrency(monthlyTarget)}</TableCell>
                        <TableCell
                          className="text-right text-sm font-medium py-2 text-blue-600 underline cursor-pointer hover:text-blue-800"
                          onClick={() => setDrilldownMember(member)}
                          title="Click to view project breakdown"
                        >
                          {formatCurrency(currentMonthData.actual)}
                        </TableCell>
                        <TableCell className="text-center py-2 border-r">{getAchievementBadge(monthlyAchievement)}</TableCell>
                        <TableCell className="text-center py-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedMember(member)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* AI Insights Section */}
        {sortedMetrics.length > 0 && (
          <CSBDInsights
            metrics={sortedMetrics}
            totals={totals}
            currentMonthTotal={currentMonthTotal}
            currentMonthTargetTotal={currentMonthTargetTotal}
            year={year}
            getCurrentMonthData={getCurrentMonthData}
          />
        )}
      </div>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMember?.full_name} - Monthly Performance</DialogTitle>
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
                      <TableHead className="text-right">Target (Projection)</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-center">Achievement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMember.monthly_performance.map((month, idx) => {
                      const monthDate = new Date(month.month);
                      const monthlyTarget = month.projection;
                      const achievement = monthlyTarget > 0 ? (month.actual / monthlyTarget) * 100 : 0;

                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-right">{monthlyTarget > 0 ? formatCurrency(monthlyTarget) : '--'}</TableCell>
                          <TableCell className="text-right font-medium">{month.actual > 0 ? formatCurrency(month.actual) : '--'}</TableCell>
                          <TableCell className="text-center">
                            {month.actual > 0 ? getAchievementBadge(achievement) : <Badge variant="outline">—</Badge>}
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

      {/* Project Credit Drilldown Dialog */}
      <Dialog open={!!drilldownMember} onOpenChange={() => setDrilldownMember(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              {drilldownMember?.full_name} - Project Credit Breakdown
            </DialogTitle>
          </DialogHeader>
          {drilldownMember && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Annual Target</div>
                  <div className="text-lg font-bold">{formatCurrency(drilldownMember.annual_target)} L</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">YTD Actual (Credit)</div>
                  <div className="text-lg font-bold text-emerald-600">{formatCurrency(drilldownMember.ytd_actual)} L</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Achievement</div>
                  <div className="text-lg font-bold">{drilldownMember.achievement_percentage.toFixed(1)}%</div>
                </div>
              </div>

              {/* Project Table */}
              {projectsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading projects...
                </div>
              ) : memberProjects && memberProjects.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs font-semibold">S#</TableHead>
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold">Project #</TableHead>
                        <TableHead className="text-xs font-semibold">Project Name</TableHead>
                        <TableHead className="text-xs font-semibold">Client</TableHead>
                        <TableHead className="text-xs font-semibold">Executed By</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Total (L)</TableHead>
                        <TableHead className="text-center text-xs font-semibold">Credit %</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Credit (L)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberProjects.map((proj, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(proj.effective_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-xs font-medium"><Link to={`/projects/view/${proj.project_id}`} className="text-primary hover:underline">{proj.project_number}</Link></TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={proj.project_name}>{proj.project_name || '—'}</TableCell>
                          <TableCell className="text-xs max-w-[160px] truncate" title={proj.client_name}>{proj.client_name || '—'}</TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate" title={proj.executed_by}>{proj.executed_by}</TableCell>
                          <TableCell className="text-right text-xs">{proj.amount_lacs.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={proj.credit_pct === 100 ? "default" : "secondary"} className="text-xs">
                              {proj.credit_pct}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-emerald-600">{proj.credit_amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={6} className="text-xs font-bold">
                          TOTAL ({memberProjects.length} projects)
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold">
                          {memberProjects.reduce((s, p) => s + p.amount_lacs, 0).toFixed(2)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right text-xs font-bold text-emerald-600">
                          {memberProjects.reduce((s, p) => s + p.credit_amount, 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No projects found for this period.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExecutiveDashboard;
