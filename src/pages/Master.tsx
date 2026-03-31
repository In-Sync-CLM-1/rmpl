import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ArrowLeft, Database, Download, RefreshCw, Upload, Filter, X, Eye, EyeOff, MapPin, Briefcase, Building2, Factory, TrendingUp, Users } from "lucide-react";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ClientSideExportDialog } from "@/components/ClientSideExportDialog";
import { SyncProgressDialog } from "@/components/SyncProgressDialog";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, AreaChart, Area, RadialBarChart, RadialBar } from "recharts";

interface MasterRecord {
  id: string;
  mobile_numb: string;
  name: string;
  designation: string | null;
  company_name: string | null;
  city: string | null;
  state: string | null;
  industry_type: string | null;
  sub_industry: string | null;
  turnover: string | null;
  emp_size: string | null;
  job_level_updated: string | null;
  deppt: string | null;
  activity_name: string | null;
  created_at: string;
}

// Type for chart aggregate response
interface ChartAggregateResponse {
  city: { name: string; value: number }[];
  jobLevel: { name: string; value: number }[];
  department: { name: string; value: number }[];
  industry: { name: string; value: number }[];
  turnover: { name: string; value: number }[];
  empSize: { name: string; value: number }[];
}

// Parse chart data to ensure values are numbers (PostgreSQL bigint can arrive as string)
const parseChartData = (arr: unknown): { name: string; value: number }[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => ({
    name: String(item.name || ''),
    value: Number(item.value) || 0,
  }));
};

// Brand colors from design system
const BRAND_COLORS = [
  'hsl(160, 84%, 39%)',  // Primary Teal
  'hsl(11, 87%, 62%)',   // Coral accent
  'hsl(271, 91%, 65%)',  // Purple secondary
  'hsl(45, 93%, 58%)',   // Soft Yellow
  'hsl(199, 89%, 70%)',  // Sky Blue
  'hsl(350, 96%, 71%)',  // Salmon
  'hsl(160, 60%, 65%)',  // Light Teal
  'hsl(280, 67%, 69%)',  // Lavender
];

const CHART_CONFIGS: Array<{
  key: 'city' | 'jobLevel' | 'department' | 'industry' | 'turnover' | 'empSize';
  title: string;
  icon: React.ElementType;
  type: 'pie' | 'donut' | 'hbar' | 'vbar' | 'area' | 'radial';
  description: string;
}> = [
  { key: 'city', title: 'Geographic Distribution', icon: MapPin, type: 'pie', description: 'Top cities by contact count' },
  { key: 'jobLevel', title: 'Seniority Breakdown', icon: Briefcase, type: 'donut', description: 'Distribution across job levels' },
  { key: 'department', title: 'Department Comparison', icon: Building2, type: 'hbar', description: 'Contacts by department' },
  { key: 'industry', title: 'Industry Segments', icon: Factory, type: 'hbar', description: 'Distribution across industries' },
  { key: 'turnover', title: 'Revenue Range', icon: TrendingUp, type: 'vbar', description: 'Companies by turnover bracket' },
  { key: 'empSize', title: 'Company Size', icon: Users, type: 'donut', description: 'Distribution by employee count' },
];

const MiniChart = ({
  title,
  data,
  icon: Icon,
  type,
  description
}: {
  title: string;
  data: { name: string; value: number }[];
  icon: React.ElementType;
  type: 'pie' | 'donut' | 'hbar' | 'vbar' | 'area' | 'radial';
  description: string;
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderChart = () => {
    // Pie Chart - Best for geographical composition
    if (type === 'pie') {
      return (
        <div className="flex items-center gap-4">
          <div className="w-[180px] h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} (${Math.round((value / total) * 100)}%)`,
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {data.slice(0, 5).map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: BRAND_COLORS[index % BRAND_COLORS.length] }}
                  />
                  <span className="text-muted-foreground truncate max-w-[120px]" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{item.value.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {Math.round((item.value / total) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Donut Chart - Perfect for showing hierarchy/levels
    if (type === 'donut') {
      return (
        <div className="flex items-center gap-4">
          <div className="w-[180px] h-[180px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} (${Math.round((value / total) * 100)}%)`,
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-foreground">{total.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {data.slice(0, 5).map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: BRAND_COLORS[index % BRAND_COLORS.length] }}
                  />
                  <span className="text-muted-foreground truncate max-w-[120px]" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{item.value.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {Math.round((item.value / total) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Horizontal Bar Chart - Best for comparing named categories
    if (type === 'hbar') {
      const maxValue = Math.max(...data.map(d => d.value));
      return (
        <div className="space-y-3 pr-2">
          {data.slice(0, 6).map((item, index) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[180px]" title={item.name}>
                  {item.name}
                </span>
                <span className="font-semibold text-foreground ml-2">{item.value.toLocaleString()}</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: BRAND_COLORS[index % BRAND_COLORS.length]
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Vertical Bar Chart - Shows ordered ranges/progression
    if (type === 'vbar') {
      return (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 60 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.length > 10 ? value.slice(0, 10) + '\u2026' : value}
                interval={0}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), "Count"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Area Chart - Good for showing trends
    if (type === 'area') {
      return (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="brandAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.length > 8 ? value.slice(0, 8) + '\u2026' : value}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), "Count"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(160, 84%, 39%)"
                strokeWidth={2}
                fill="url(#brandAreaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Radial Bar Chart
    if (type === 'radial') {
      const radialData = data.slice(0, 5).map((item, index) => ({
        ...item,
        fill: BRAND_COLORS[index % BRAND_COLORS.length],
      }));

      return (
        <div className="flex items-center gap-4">
          <div className="w-[180px] h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="25%"
                outerRadius="100%"
                data={radialData}
                startAngle={180}
                endAngle={-180}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={4}
                  background={{ fill: 'hsl(var(--muted))' }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {radialData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-muted-foreground truncate max-w-[120px]" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <span className="font-semibold text-foreground">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="col-span-1 overflow-hidden border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 bg-card">
      <CardHeader className="pb-3 pt-4 px-5 border-b border-border/30">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-foreground">{title}</span>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs font-medium">
            {total.toLocaleString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4 px-5">
        {data.length > 0 ? (
          renderChart()
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MasterFilters {
  activity_name: string[];
  turnover: string[];
  emp_size: string[];
  industry_type: string[];
  sub_industry: string[];
  city: string[];
  state: string[];
  job_level_updated: string[];
  deppt: string[];
}

const emptyFilters: MasterFilters = {
  activity_name: [],
  turnover: [],
  emp_size: [],
  industry_type: [],
  sub_industry: [],
  city: [],
  state: [],
  job_level_updated: [],
  deppt: [],
};

export default function Master() {
  const navigate = useNavigate();
  const { permissions, userRoles } = useUserPermissions();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<MasterRecord | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [filters, setFilters] = useState<MasterFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);

  const isAdmin = userRoles.some(role =>
    ['admin', 'super_admin', 'platform_admin'].includes(role)
  );

  // Fetch distinct filter options using database function (bypasses 1000 row limit)
  const { data: filterOptions } = useQuery({
    queryKey: ["master-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_master_filter_options');
      
      if (error) {
        console.error('Error fetching filter options:', error);
        return {
          activity_name: [],
          turnover: [],
          emp_size: [],
          industry_type: [],
          sub_industry: [],
          city: [],
          state: [],
          job_level_updated: [],
          deppt: [],
        };
      }
      
      // Type assertion for the jsonb response
      const result = data as Record<string, string[]> | null;
      
      return {
        activity_name: result?.activity_name || [],
        turnover: result?.turnover || [],
        emp_size: result?.emp_size || [],
        industry_type: result?.industry_type || [],
        sub_industry: result?.sub_industry || [],
        city: result?.city || [],
        state: result?.state || [],
        job_level_updated: result?.job_level_updated || [],
        deppt: result?.deppt || [],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch chart distribution data using Postgres-level aggregation (no row limit issues)
  const { data: chartData } = useQuery({
    queryKey: ["master-chart-data", JSON.stringify(filters)],
    queryFn: async (): Promise<ChartAggregateResponse> => {
      const { data, error } = await supabase.rpc('get_master_chart_aggregates', {
        p_activity_names: filters.activity_name.length > 0 ? filters.activity_name : null,
        p_turnovers: filters.turnover.length > 0 ? filters.turnover : null,
        p_emp_sizes: filters.emp_size.length > 0 ? filters.emp_size : null,
        p_industry_types: filters.industry_type.length > 0 ? filters.industry_type : null,
        p_sub_industries: filters.sub_industry.length > 0 ? filters.sub_industry : null,
        p_cities: filters.city.length > 0 ? filters.city : null,
        p_states: filters.state.length > 0 ? filters.state : null,
        p_job_levels: filters.job_level_updated.length > 0 ? filters.job_level_updated : null,
        p_departments: filters.deppt.length > 0 ? filters.deppt : null,
      });

      if (error) {
        console.error('Error fetching chart data:', error);
        return { city: [], jobLevel: [], department: [], industry: [], turnover: [], empSize: [] };
      }

      const result = data as unknown as ChartAggregateResponse;
      return {
        city: parseChartData(result?.city),
        jobLevel: parseChartData(result?.jobLevel),
        department: parseChartData(result?.department),
        industry: parseChartData(result?.industry),
        turnover: parseChartData(result?.turnover),
        empSize: parseChartData(result?.empSize),
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const activeFilterCount = Object.values(filters).reduce(
    (count, arr) => count + arr.length,
    0
  );

  const clearAllFilters = () => {
    setFilters(emptyFilters);
  };

  const {
    data: masterRecords,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePaginatedQuery<MasterRecord>({
    queryKey: ["master", JSON.stringify(filters)],
    queryFn: async (from, to) => {
      let query = supabase
        .from("master" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.activity_name.length > 0) {
        query = query.in("activity_name", filters.activity_name);
      }
      if (filters.turnover.length > 0) {
        query = query.in("turnover", filters.turnover);
      }
      if (filters.emp_size.length > 0) {
        query = query.in("emp_size", filters.emp_size);
      }
      if (filters.industry_type.length > 0) {
        query = query.in("industry_type", filters.industry_type);
      }
      if (filters.sub_industry.length > 0) {
        query = query.in("sub_industry", filters.sub_industry);
      }
      if (filters.city.length > 0) {
        query = query.in("city", filters.city);
      }
      if (filters.state.length > 0) {
        query = query.in("state", filters.state);
      }
      if (filters.job_level_updated.length > 0) {
        query = query.in("job_level_updated", filters.job_level_updated);
      }
      if (filters.deppt.length > 0) {
        query = query.in("deppt", filters.deppt);
      }

      const { data, error, count } = await query.range(from, to);

      return { data, count, error };
    },
  });

  const { delete: deleteRecord, isDeleting } = useCrudMutation<MasterRecord>({
    queryKey: ["master"],
    createFn: async () => null as any,
    updateFn: async () => null as any,
    deleteFn: async (id) => {
      const { error } = await supabase.from("master" as any).delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: {
      delete: "Master record deleted successfully",
    },
    errorMessages: {
      delete: "Failed to delete master record",
    },
  });


  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to sync");
        return;
      }
      const { data, error } = await supabase.functions.invoke(
        'sync-demandcom-to-master',
        { body: { trigger: 'manual', triggered_by_user_id: session.user.id } }
      );
      if (error) {
        if (error.message?.includes('already in progress')) {
          toast.error("A sync is already in progress");
        } else {
          toast.error(`Sync failed: ${error.message}`);
        }
        return;
      }
      setActiveSyncId(data.syncId);
      setShowSyncProgress(true);
      toast.success(`Sync started! Processing ${data.totalRecords} records in ${data.totalBatches} batches`);
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncComplete = async () => {
    setActiveSyncId(null);
    await supabase.rpc('refresh_master_caches').catch(() => {});
    window.location.reload();
  };

  const handleExportData = () => {
    setShowExportOptions(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRecord(deleteId);
      setDeleteId(null);
      setRecordToDelete(null);
    }
  };

  const columns: DataTableColumn<MasterRecord>[] = [
    {
      header: "Name",
      accessorKey: "name",
      cell: (record) => <span className="font-medium">{record.name}</span>,
    },
    {
      header: "Mobile Number",
      accessorKey: "mobile_numb",
    },
    {
      header: "Designation",
      cell: (record) => record.designation || "N/A",
    },
    {
      header: "Company",
      cell: (record) => record.company_name || "N/A",
    },
    {
      header: "City",
      cell: (record) => record.city || "N/A",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold">Master</h1>
              <p className="text-muted-foreground mt-1">
                Manage your master database
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant={activeFilterCount > 0 ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            {isAdmin && (
              <Button
                onClick={handleSyncNow}
                variant="ghost"
                size="icon"
                disabled={isSyncing}
                title="Sync DemandCom to Master"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => setShowBulkImport(true)}
                variant="ghost"
                size="icon"
                title="Import Data"
              >
                <Upload className="h-4 w-4" />
              </Button>
            )}
            <Button 
              onClick={handleExportData} 
              variant="ghost" 
              size="icon"
              title="Export Data"
            >
              <Download className="h-4 w-4" />
            </Button>
        </div>
        </div>

        {/* Results Count Banner */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-lg px-4 py-2 flex items-center gap-2">
              <Database className="h-5 w-5" />
              <span className="text-lg font-semibold">
                {totalCount.toLocaleString()} {totalCount === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            {activeFilterCount > 0 && (
              <span className="text-sm text-muted-foreground">
                (filtered)
              </span>
            )}
          </div>
          <Button
            onClick={() => setShowRecords(!showRecords)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {showRecords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showRecords ? "Hide Records" : "Show Records"}
          </Button>
        </div>

        {/* Filters Panel - Above charts */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent className="mb-6">
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sm">Filter Records</h3>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-8 gap-1 text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                    Clear all
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <MultiSelectFilter
                  options={filterOptions?.activity_name || []}
                  selected={filters.activity_name}
                  onChange={(values) => setFilters(f => ({ ...f, activity_name: values }))}
                  placeholder="Search..."
                  triggerLabel="Activity Name"
                />
                <MultiSelectFilter
                  options={filterOptions?.turnover || []}
                  selected={filters.turnover}
                  onChange={(values) => setFilters(f => ({ ...f, turnover: values }))}
                  placeholder="Search..."
                  triggerLabel="Turnover"
                />
                <MultiSelectFilter
                  options={filterOptions?.emp_size || []}
                  selected={filters.emp_size}
                  onChange={(values) => setFilters(f => ({ ...f, emp_size: values }))}
                  placeholder="Search..."
                  triggerLabel="EMP Size"
                />
                <MultiSelectFilter
                  options={filterOptions?.industry_type || []}
                  selected={filters.industry_type}
                  onChange={(values) => setFilters(f => ({ ...f, industry_type: values }))}
                  placeholder="Search..."
                  triggerLabel="Industry"
                />
                <MultiSelectFilter
                  options={filterOptions?.sub_industry || []}
                  selected={filters.sub_industry}
                  onChange={(values) => setFilters(f => ({ ...f, sub_industry: values }))}
                  placeholder="Search..."
                  triggerLabel="Sub Industry"
                />
                <MultiSelectFilter
                  options={filterOptions?.city || []}
                  selected={filters.city}
                  onChange={(values) => setFilters(f => ({ ...f, city: values }))}
                  placeholder="Search..."
                  triggerLabel="City"
                />
                <MultiSelectFilter
                  options={filterOptions?.state || []}
                  selected={filters.state}
                  onChange={(values) => setFilters(f => ({ ...f, state: values }))}
                  placeholder="Search..."
                  triggerLabel="State"
                />
                <MultiSelectFilter
                  options={filterOptions?.job_level_updated || []}
                  selected={filters.job_level_updated}
                  onChange={(values) => setFilters(f => ({ ...f, job_level_updated: values }))}
                  placeholder="Search..."
                  triggerLabel="Job Level"
                />
                <MultiSelectFilter
                  options={filterOptions?.deppt || []}
                  selected={filters.deppt}
                  onChange={(values) => setFilters(f => ({ ...f, deppt: values }))}
                  placeholder="Search..."
                  triggerLabel="Department"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Distribution Charts - 2 column layout for better readability */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {CHART_CONFIGS.map((config) => (
            <MiniChart 
              key={config.key}
              title={config.title} 
              data={chartData?.[config.key] || []} 
              icon={config.icon}
              type={config.type}
              description={config.description}
            />
          ))}
        </div>


        {showRecords && (
          <DataTable
            data={masterRecords}
            columns={columns}
            isLoading={isLoading}
            getRowKey={(record) => record.id}
            emptyState={{
              icon: Database,
            title: "No records found",
            description: "Get started by adding your first master record",
            actionLabel: "Add Record",
            onAction: () => navigate("/master/new"),
          }}
          pagination={{
            currentPage,
            totalPages,
            totalItems: totalCount,
            itemsPerPage,
            onPageChange: handlePageChange,
            onItemsPerPageChange: handleItemsPerPageChange,
          }}
          actions={(record) => (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/master/${record.id}`)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {permissions.canDeleteMaster && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDeleteId(record.id);
                    setRecordToDelete(record);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        />
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setRecordToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        itemName={recordToDelete?.name}
        isLoading={isDeleting}
      />

      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        tableName="master"
        tableLabel="Master"
        requiredColumns={['name', 'mobile_numb']}
        templateColumns={[
          'name',
          'mobile_numb',
          'assigned_to',
          'mobile2',
          'official',
          'personal_email_id',
          'generic_email_id',
          'linkedin',
          'designation',
          'deppt',
          'job_level_updated',
          'company_name',
          'industry_type',
          'sub_industry',
          'website',
          'emp_size',
          'turnover',
          'erp_name',
          'erp_vendor',
          'address',
          'location',
          'city',
          'state',
          'zone',
          'tier',
          'pincode',
          'activity_name',
          'country',
          'source',
          'source_1',
          'extra',
          'extra_1',
          'extra_2',
          'user_id',
          'salutation',
          'turnover_link',
          'company_linkedin_url',
          'associated_member_linkedin',
          'latest_disposition',
          'latest_subdisposition',
          'updated_at',
          'assigned_by'
        ]}
        onImportComplete={async () => {
          // Refresh materialized view caches after import
          await supabase.rpc('refresh_master_caches').catch(() => {});
          window.location.reload();
        }}
      />

        <ClientSideExportDialog
          open={showExportOptions}
          onOpenChange={setShowExportOptions}
          tableName="master"
          filenamePrefix="master-export"
          filters={filters}
          filteredCount={totalCount}
        />

        <SyncProgressDialog
          open={showSyncProgress}
          onOpenChange={setShowSyncProgress}
          syncId={activeSyncId}
          onComplete={handleSyncComplete}
        />
    </div>
  );
}
