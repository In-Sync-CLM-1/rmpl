import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, TrendingUp, TrendingDown, Download, ArrowLeft, Save, AlertTriangle, Lock } from "lucide-react";
import { useCSBDProjections, useCSBDTarget } from "@/hooks/useCSBDProjections";
import { useAllCSBDMetrics } from "@/hooks/useCSBDMetrics";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { CSBDTeamOverview } from "@/components/csbd/CSBDTeamOverview";
import { format } from "date-fns";

// Check if today is past the projection deadline for a given month (3rd of the month)
const isPastDeadline = (monthDate: Date): boolean => {
  const now = new Date();
  const deadline = new Date(monthDate.getFullYear(), monthDate.getMonth(), 3, 23, 59, 59);
  return now > deadline;
};

// Check if a month is within its editable window (25th of previous month to 3rd of target month)
const isMonthEditable = (monthDate: Date): boolean => {
  const now = new Date();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  
  // Window start: 25th of previous month
  const windowStart = new Date(year, month - 1, 25, 0, 0, 0);
  // Window end: 3rd of target month
  const windowEnd = new Date(year, month, 3, 23, 59, 59);
  
  return now >= windowStart && now <= windowEnd;
};

// Get the edit window description for a month
const getEditWindowDescription = (monthDate: Date): string => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const windowStart = new Date(year, month - 1, 25);
  const windowEnd = new Date(year, month, 3);
  
  return `${format(windowStart, 'MMM d')} - ${format(windowEnd, 'MMM d, yyyy')}`;
};
const CSBDProjections = () => {
  const navigate = useNavigate();
  const [year, setYear] = useState(2026);
  const [activeTab, setActiveTab] = useState<'my-projections' | 'team-view'>('my-projections');

  const { permissions, userRoles, isLoading: rolesLoading } = useUserPermissions();
  const isAdmin = userRoles.some(r => 
    ['platform_admin', 'super_admin', 'admin', 'admin_tech', 'admin_administration'].includes(r)
  );

  const { data: target, isLoading: targetLoading } = useCSBDTarget(undefined, year);
  const { projections, isLoading: projectionsLoading, upsertProjection } = useCSBDProjections(undefined, year);
  const { data: allMetrics, isLoading: metricsLoading } = useAllCSBDMetrics(year);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const metrics = allMetrics?.find(m => m.user_id === currentUserId) ?? null;

  const [editingValues, setEditingValues] = useState<Record<string, number>>({});
  const [dirtyMonths, setDirtyMonths] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projections) {
      const values: Record<string, number> = {};
      projections.forEach(proj => {
        values[proj.month] = proj.projection_amount_inr_lacs;
      });
      setEditingValues(values);
    }
  }, [projections]);

  const handleProjectionChange = (month: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditingValues(prev => ({ ...prev, [month]: numValue }));
    setDirtyMonths(prev => new Set(prev).add(month));
  };

  const handleSaveAllProjections = async () => {
    if (!target || dirtyMonths.size === 0) return;
    
    setIsSaving(true);
    try {
      const savePromises = Array.from(dirtyMonths).map(month => {
        const value = editingValues[month];
        if (value < 0) {
          toast.error(`Projection for ${month} cannot be negative`);
          return Promise.resolve();
        }
        
        return upsertProjection.mutateAsync({
          user_id: target.user_id,
          month,
          projection_amount_inr_lacs: value,
        });
      });
      
      await Promise.all(savePromises);
      
      setDirtyMonths(new Set());
      toast.success("All projections saved successfully");
    } catch (error) {
      console.error("Error saving projections:", error);
      toast.error("Failed to save projections");
    } finally {
      setIsSaving(false);
    }
  };

  // Generate all 12 months for calendar year
  const generateYearMonths = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(year, i, 1); // Start from January
      months.push(date);
    }
    return months;
  };

  const yearMonths = generateYearMonths();
  const currentDate = new Date();

  const getStatusBadge = (month: Date, actual: number, projection: number) => {
    if (month > currentDate) {
      return <Badge variant="outline">⏳ Pending</Badge>;
    }
    
    if (actual === 0) {
      return <Badge variant="outline">⏳ Pending</Badge>;
    }

    const variance = actual - projection;
    if (variance > 0) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">🟢 Over</Badge>;
    } else if (variance < -5) {
      return <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-0">🔴 Under</Badge>;
    } else {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">🟡 On Track</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toFixed(2)}L`;
  };

  if (rolesLoading || targetLoading || projectionsLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Loading projections..." />
      </div>
    );
  }

  // Check if current month's projection is missing after the deadline
  const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthProjection = projections?.find(p => p.month === currentMonthStr);
  const isCurrentMonthPastDeadline = isPastDeadline(currentMonth);
  const isBlocked = isCurrentMonthPastDeadline && !currentMonthProjection && target && !isAdmin;

  if (isBlocked) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-destructive">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              The projection entry deadline for <strong>{format(currentMonth, 'MMMM yyyy')}</strong> has passed.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 max-w-sm mx-auto">
              <p className="text-sm text-muted-foreground">
                <Lock className="inline-block h-4 w-4 mr-1 -mt-0.5" />
                Deadline was: <strong>{format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 3), 'MMMM d, yyyy')}</strong>
              </p>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Please contact your administrator to populate your projection before you can continue.
            </p>
            <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user is admin but doesn't have a target, show team overview
  if (!target && isAdmin) {
    return (
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">CSBD Team Projections {year}</h1>
            <p className="text-muted-foreground">View all CSBD team members' projections and performance</p>
          </div>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">FY 2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CSBDTeamOverview fiscalYear={year} />
      </div>
    );
  }

  // Check if user has CSBD role but no saved target yet
  const hasCSBDRole = userRoles.some(r => r === 'csbd');

  if (!target) {
    // User has csbd role but hasn't saved their target yet
    if (hasCSBDRole) {
      return (
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <Target className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">Set Up Your CSBD Target</h2>
              <p className="text-muted-foreground">
                You need to save your annual target for {year} before you can enter projections.
              </p>
              <Button onClick={() => navigate('/csbd-targets')}>
                Go to CSBD Targets
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    // User doesn't have csbd role - no access
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">No target found for {year}. You don't have access to CSBD projections.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">CSBD Projections {year}</h1>
          <p className="text-muted-foreground">Manage your monthly projections and track performance</p>
        </div>
        <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026">FY 2026</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Annual Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(target.annual_target_inr_lacs)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">YTD Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics?.ytd_actual || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.achievement_percentage.toFixed(1)}% of target
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">YTD Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.ytd_projection || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.projection_fulfilment_percentage.toFixed(1)}% fulfilment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(metrics?.ytd_variance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(metrics?.ytd_variance || 0) >= 0 ? '+' : ''}{formatCurrency(metrics?.ytd_variance || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {target.has_subordinates && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="my-projections">My Projections</TabsTrigger>
            <TabsTrigger value="team-view">Team View</TabsTrigger>
          </TabsList>

          <TabsContent value="my-projections">
            <ProjectionsTable
              fyMonths={yearMonths}
              metrics={metrics}
              editingValues={editingValues}
              onProjectionChange={handleProjectionChange}
              onSaveAll={handleSaveAllProjections}
              dirtyMonths={dirtyMonths}
              isSaving={isSaving}
              getStatusBadge={getStatusBadge}
              formatCurrency={formatCurrency}
              currentDate={currentDate}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="team-view">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Team view coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!target.has_subordinates && (
        <ProjectionsTable
          fyMonths={yearMonths}
          metrics={metrics}
          editingValues={editingValues}
          onProjectionChange={handleProjectionChange}
          onSaveAll={handleSaveAllProjections}
          dirtyMonths={dirtyMonths}
          isSaving={isSaving}
          getStatusBadge={getStatusBadge}
          formatCurrency={formatCurrency}
          currentDate={currentDate}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

interface ProjectionsTableProps {
  fyMonths: Date[];
  metrics: any;
  editingValues: Record<string, number>;
  onProjectionChange: (month: string, value: string) => void;
  onSaveAll: () => void;
  dirtyMonths: Set<string>;
  isSaving: boolean;
  getStatusBadge: (month: Date, actual: number, projection: number) => JSX.Element;
  formatCurrency: (value: number) => string;
  currentDate: Date;
  isAdmin?: boolean;
}

const ProjectionsTable = ({
  fyMonths,
  metrics,
  editingValues,
  onProjectionChange,
  onSaveAll,
  dirtyMonths,
  isSaving,
  getStatusBadge,
  formatCurrency,
  currentDate,
  isAdmin = false,
}: ProjectionsTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Projection Grid</CardTitle>
        <CardDescription>Enter your monthly projections and track actual performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Month</th>
                <th className="text-right p-3 font-medium">Projection (₹L)</th>
                <th className="text-right p-3 font-medium">Actual (₹L)</th>
                <th className="text-right p-3 font-medium">Variance (₹L)</th>
                <th className="text-center p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
            {fyMonths.map((month, idx) => {
                // Format date without timezone conversion (always use 1st of month)
                const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
                const monthlyData = metrics?.monthly_performance.find((m: any) => m.month === monthStr);
                const projection = monthlyData?.projection || 0;
                const actual = monthlyData?.actual || 0;
                const variance = actual - projection;
                
                // Check if this month is editable (admins can always edit)
                const editable = isAdmin || isMonthEditable(month);
                const pastDeadline = isPastDeadline(month);
                const windowDescription = getEditWindowDescription(month);

                return (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">
                      <div>{month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</div>
                      {!editable && !isAdmin && (
                        <span className="text-xs text-muted-foreground">
                          {pastDeadline ? (
                            <span className="text-destructive/70">Deadline passed</span>
                          ) : (
                            <span>Opens {format(new Date(month.getFullYear(), month.getMonth() - 1, 25), 'MMM d')}</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-end gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingValues[monthStr] || ''}
                          onChange={(e) => onProjectionChange(monthStr, e.target.value)}
                          className={`text-right max-w-[120px] ${
                            dirtyMonths.has(monthStr) ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' : ''
                          } ${!editable ? 'bg-muted cursor-not-allowed opacity-60' : ''}`}
                          placeholder="0.00"
                          disabled={isSaving || !editable}
                          title={!editable ? `Edit window: ${windowDescription}` : ''}
                        />
                        {editable && !pastDeadline && (
                          <span className="text-xs text-emerald-600">Open until {format(new Date(month.getFullYear(), month.getMonth(), 3), 'MMM d')}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {actual > 0 ? formatCurrency(actual) : '--'}
                    </td>
                    <td className={`p-3 text-right font-medium ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {actual > 0 ? `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}` : '--'}
                    </td>
                    <td className="p-3 text-center">
                      {getStatusBadge(month, actual, projection)}
                    </td>
                  </tr>
                );
              })}
              {/* YTD Summary Row */}
              <tr className="bg-muted/50 font-bold">
                <td className="p-3">YTD Total</td>
                <td className="p-3 text-right">{formatCurrency(metrics?.ytd_projection || 0)}</td>
                <td className="p-3 text-right">{formatCurrency(metrics?.ytd_actual || 0)}</td>
                <td className={`p-3 text-right ${(metrics?.ytd_variance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {(metrics?.ytd_variance || 0) >= 0 ? '+' : ''}{formatCurrency(metrics?.ytd_variance || 0)}
                </td>
                <td className="p-3 text-center">
                  {metrics?.achievement_percentage.toFixed(1)}% Achieved
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {dirtyMonths.size > 0 ? (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
                {dirtyMonths.size} unsaved change{dirtyMonths.size > 1 ? 's' : ''}
              </Badge>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <Button 
            onClick={onSaveAll}
            disabled={dirtyMonths.size === 0 || isSaving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Projections"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CSBDProjections;
