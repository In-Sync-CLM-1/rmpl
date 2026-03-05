import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, Play, Upload, DollarSign, Users, Calendar, 
  Check, X, Loader2, RefreshCw, Eye 
} from "lucide-react";
import { toast } from "sonner";
import { EmployeeDataImportDialog } from "@/components/EmployeeDataImportDialog";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SalarySlipsAdmin() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissions();

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["all-employees-salary-details"],
    queryFn: async () => {
      const { data: salaryDetails, error } = await supabase
        .from("employee_salary_details")
        .select("*");
      
      if (error) throw error;
      
      // Get profile names
      const userIds = salaryDetails?.map(e => e.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      return salaryDetails?.map(emp => ({
        ...emp,
        profile: profiles?.find(p => p.id === emp.user_id) || { full_name: "Unknown", email: "" }
      })) || [];
    },
  });

  const { data: salarySlips = [], isLoading: loadingSlips, refetch: refetchSlips } = useQuery({
    queryKey: ["admin-salary-slips", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_slips")
        .select("*")
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      
      if (error) throw error;
      
      // Get profile names
      const userIds = data?.map(s => s.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      return data?.map(slip => ({
        ...slip,
        profile: profiles?.find(p => p.id === slip.user_id) || { full_name: "Unknown", email: "" }
      })) || [];
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      setIsGenerating(true);
      const { data, error } = await supabase.functions.invoke("bulk-generate-salary-slips", {
        body: { month: selectedMonth, year: selectedYear, publish },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Salary slips generated successfully");
      refetchSlips();
      setIsGenerating(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to generate salary slips: " + error.message);
      setIsGenerating(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ slipId, publish }: { slipId: string; publish: boolean }) => {
      const { error } = await supabase
        .from("salary_slips")
        .update({ is_published: publish })
        .eq("id", slipId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.publish ? "Salary slip published" : "Salary slip unpublished");
      queryClient.invalidateQueries({ queryKey: ["admin-salary-slips"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const publishAllMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const slipIds = salarySlips.filter(s => s.is_published !== publish).map(s => s.id);
      if (slipIds.length === 0) return;
      
      const { error } = await supabase
        .from("salary_slips")
        .update({ is_published: publish })
        .in("id", slipIds);
      if (error) throw error;
    },
    onSuccess: (_, publish) => {
      toast.success(publish ? "All salary slips published" : "All salary slips unpublished");
      queryClient.invalidateQueries({ queryKey: ["admin-salary-slips"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!permissions.canManageSalarySlips) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to manage salary slips.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Salary Slips Administration</h1>
          <p className="text-muted-foreground">Generate and manage monthly salary slips</p>
        </div>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">Generate Slips</TabsTrigger>
          <TabsTrigger value="manage">Manage Slips</TabsTrigger>
          <TabsTrigger value="employees">Employee Details</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Salary Slips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={index} value={String(index + 1)}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => generateAllMutation.mutate(false)}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Generate All
                </Button>
                <Button
                  variant="default"
                  onClick={() => generateAllMutation.mutate(true)}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Generate & Publish
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{employees.length}</p>
                        <p className="text-sm text-muted-foreground">Employees with Salary Details</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{salarySlips.length}</p>
                        <p className="text-sm text-muted-foreground">Slips for {MONTHS[selectedMonth - 1]}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Check className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold">{salarySlips.filter(s => s.is_published).length}</p>
                        <p className="text-sm text-muted-foreground">Published Slips</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Salary Slips - {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchSlips()}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
                <Button variant="default" size="sm" onClick={() => publishAllMutation.mutate(true)}>
                  <Check className="h-4 w-4 mr-1" />
                  Publish All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSlips ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : salarySlips.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No salary slips generated for this month. Click "Generate All" to create them.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Paid Days</TableHead>
                      <TableHead>Total Earnings</TableHead>
                      <TableHead>Total Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salarySlips.map((slip: any) => (
                      <TableRow key={slip.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{slip.profile?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{slip.profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{slip.paid_days}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(slip.total_earnings)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(slip.total_deductions)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(slip.net_pay)}</TableCell>
                        <TableCell>
                          <Badge variant={slip.is_published ? "default" : "secondary"}>
                            {slip.is_published ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => publishMutation.mutate({ slipId: slip.id, publish: !slip.is_published })}
                            >
                              {slip.is_published ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Employee Salary Details</CardTitle>
              <Button onClick={() => setImportOpen(true)} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import Employee Data
              </Button>
            </CardHeader>
            <CardContent>
              {loadingEmployees ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : employees.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No employee salary details configured yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>EPF %</TableHead>
                      <TableHead>PF Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp: any) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{emp.profile?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{emp.profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{emp.employee_code || "N/A"}</TableCell>
                        <TableCell>{emp.department || "N/A"}</TableCell>
                        <TableCell>{formatCurrency(emp.basic_salary || 0)}</TableCell>
                        <TableCell>{emp.epf_percentage || 12}%</TableCell>
                        <TableCell>{emp.pf_number || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeDataImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
