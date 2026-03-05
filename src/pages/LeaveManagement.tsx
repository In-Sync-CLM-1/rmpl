import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, Calendar, Briefcase, Clock, Baby, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { HolidayList } from "@/components/leave/HolidayList";
import { OptionalHolidayClaim } from "@/components/leave/OptionalHolidayClaim";
import { UpcomingHolidays } from "@/components/leave/UpcomingHolidays";
import { useCompanyHolidays, countWorkingDays } from "@/hooks/useCompanyHolidays";

interface SandwichLeaveResult {
  requested_working_days: number;
  weekend_days: number;
  holiday_days: number;
  is_sandwich: boolean;
  total_deduction: number;
  start_date: string;
  end_date: string;
}

const LEAVE_TYPES = [
  { value: "casual_leave", label: "Casual Leave", icon: Calendar, color: "text-blue-500", balanceKey: "casual_leave_balance", limitKey: "casual_leave_limit" },
  { value: "earned_leave", label: "Earned Leave", icon: Briefcase, color: "text-green-500", balanceKey: "earned_leave_balance", limitKey: "earned_leave_limit" },
  { value: "compensatory_off", label: "Comp Off", icon: Clock, color: "text-purple-500", balanceKey: "compensatory_off_balance", limitKey: "compensatory_off_limit" },
  { value: "maternity_leave", label: "Maternity Leave", icon: Baby, color: "text-pink-500", balanceKey: "maternity_leave_balance", limitKey: "maternity_leave_limit" },
  { value: "paternity_leave", label: "Paternity Leave", icon: Baby, color: "text-cyan-500", balanceKey: "paternity_leave_balance", limitKey: "paternity_leave_limit" },
];

export default function LeaveManagement() {
  const [open, setOpen] = useState(false);
  const [showHolidayList, setShowHolidayList] = useState(false);
  const [sandwichResult, setSandwichResult] = useState<SandwichLeaveResult | null>(null);
  const [calculatingDays, setCalculatingDays] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    total_days: "",
    reason: "",
  });
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const { applicableHolidays, userLocation } = useCompanyHolidays(currentYear);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: leaveBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ["leave-balance", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", currentYear)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ["leave-applications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("leave_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const applyLeaveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id) throw new Error("User not found");
      
      const { error } = await supabase
        .from("leave_applications")
        .insert({
          user_id: user.id,
          leave_type: data.leave_type as any,
          start_date: data.start_date,
          end_date: data.end_date,
          total_days: parseFloat(data.total_days),
          reason: data.reason,
          sandwich_days: sandwichResult?.is_sandwich ? sandwichResult.weekend_days + sandwichResult.holiday_days : 0,
          leave_calculation: sandwichResult as any,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      setOpen(false);
      setFormData({
        leave_type: "",
        start_date: "",
        end_date: "",
        total_days: "",
        reason: "",
      });
      setSandwichResult(null);
      toast.success("Leave application submitted successfully!");
    },
    onError: (error: Error) => {
      toast.error("Failed to submit leave: " + error.message);
    },
  });

  const cancelLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leave_applications")
        .update({ status: "cancelled" })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      toast.success("Leave cancelled successfully!");
    },
    onError: (error: Error) => {
      toast.error("Failed to cancel leave: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status.toUpperCase()}</Badge>;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyLeaveMutation.mutate(formData);
  };

  // Calculate days when dates change using sandwich leave policy
  const handleDateChange = async (field: "start_date" | "end_date", value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    if (newFormData.start_date && newFormData.end_date) {
      const start = new Date(newFormData.start_date);
      const end = new Date(newFormData.end_date);
      
      if (end >= start) {
        setCalculatingDays(true);
        try {
          // Call the database function to calculate sandwich leave
          // Using type assertion since function was just created
          const { data: result, error } = await (supabase.rpc as any)('calculate_sandwich_leave_days', {
            p_start_date: newFormData.start_date,
            p_end_date: newFormData.end_date,
            p_user_location: userLocation || 'Delhi'
          });
          
          if (error) {
            console.error('Error calculating sandwich leave:', error);
            // Fallback to simple calculation
            const { workingDays } = countWorkingDays(start, end, applicableHolidays, userLocation || "Delhi");
            setFormData(prev => ({ ...prev, total_days: String(workingDays) }));
            setSandwichResult(null);
          } else {
            const sandwichData = result as SandwichLeaveResult;
            setSandwichResult(sandwichData);
            setFormData(prev => ({ ...prev, total_days: String(sandwichData.total_deduction) }));
          }
        } catch (err) {
          console.error('Error:', err);
        } finally {
          setCalculatingDays(false);
        }
      }
    }
  };

  const getLeaveBalance = (balanceKey: string) => {
    if (!leaveBalance) return 0;
    return (leaveBalance as any)[balanceKey] || 0;
  };

  const getLeaveLimit = (limitKey: string) => {
    if (!leaveBalance) return 0;
    return (leaveBalance as any)[limitKey] || 0;
  };

  const isLowBalance = (balance: number, limit: number) => {
    return limit > 0 && balance <= 2;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">Apply for leave and track your applications</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Apply for Leave
        </Button>
      </div>

      {/* Leave Balances */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {LEAVE_TYPES.map((type) => {
          const Icon = type.icon;
          const balance = getLeaveBalance(type.balanceKey);
          const limit = getLeaveLimit(type.limitKey);
          const lowBalance = isLowBalance(balance, limit);
          
          // Show all leave types always (SL, CL, EL, Comp Off, Mat, Pat)
          
          const hasNoRecord = !leaveBalance;
          
          return (
            <Card key={type.value} className={lowBalance ? "border-destructive" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${type.color}`} />
                  <span className="text-sm font-medium truncate">{type.label}</span>
                </div>
                <div className={`text-3xl font-bold ${lowBalance ? "text-destructive" : ""}`}>
                  {hasNoRecord ? '-' : balance} <span className="text-lg font-normal text-muted-foreground">/ {hasNoRecord ? '-' : limit}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasNoRecord ? "No record for this year" : lowBalance ? "Low balance!" : "days remaining"}
                </p>
              </CardContent>
            </Card>
          );
        }).filter(Boolean)}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Applications */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                My Leave Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {applications?.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {LEAVE_TYPES.find(t => t.value === app.leave_type)?.label || app.leave_type}
                          </span>
                          {getStatusBadge(app.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(app.start_date), "MMM d")} - {format(new Date(app.end_date), "MMM d, yyyy")} ({app.total_days} days)
                        </div>
                        {app.reason && <div className="text-sm mt-1">{app.reason}</div>}
                      </div>
                      {app.status === "pending" && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => cancelLeaveMutation.mutate(app.id)}
                          disabled={cancelLeaveMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!applications?.length && (
                    <div className="text-center py-8 text-muted-foreground">
                      No leave applications yet
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Holidays */}
        <div className="space-y-6">
          <UpcomingHolidays />
          <OptionalHolidayClaim />
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowHolidayList(true)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            View Full Holiday Calendar
          </Button>
        </div>
      </div>

      {/* Apply Leave Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-visible">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={formData.leave_type} onValueChange={(value) => setFormData({ ...formData, leave_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((type) => {
                    const balance = getLeaveBalance(type.balanceKey);
                    const limit = getLeaveLimit(type.limitKey);
                    // Show all leave types always
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} ({balance}/{limit || '-'} available)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formData.leave_type && (() => {
                const selectedType = LEAVE_TYPES.find(t => t.value === formData.leave_type);
                if (!selectedType) return null;
                const balance = getLeaveBalance(selectedType.balanceKey);
                const limit = getLeaveLimit(selectedType.limitKey);
                const lowBalance = isLowBalance(balance, limit);
                const Icon = selectedType.icon;
                return (
                  <div className={`flex items-center gap-2 p-2 rounded-md ${lowBalance ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${selectedType.color}`} />
                    <span className="text-sm font-medium">
                      Balance: {balance} / {limit} days
                    </span>
                    {lowBalance && <span className="text-xs">(Low balance!)</span>}
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={formData.start_date}
                  onChange={(e) => handleDateChange("start_date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={formData.end_date}
                  onChange={(e) => handleDateChange("end_date", e.target.value)}
                  min={formData.start_date}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total Days {calculatingDays && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}</Label>
              <Input 
                type="number" 
                step="0.5"
                value={formData.total_days}
                onChange={(e) => setFormData({ ...formData, total_days: e.target.value })}
                placeholder="e.g., 1, 0.5 for half day"
                required
              />
              {sandwichResult?.is_sandwich && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">Sandwich Leave Policy Applied</p>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      Your leave spans weekends/holidays. Deduction includes: {sandwichResult.requested_working_days} working day(s) + {sandwichResult.weekend_days} weekend day(s) + {sandwichResult.holiday_days} holiday(s) = <strong>{sandwichResult.total_deduction} total days</strong>
                    </p>
                  </div>
                </div>
              )}
              {!sandwichResult?.is_sandwich && formData.start_date && formData.end_date && (
                <p className="text-xs text-muted-foreground">
                  Weekends and holidays are excluded from deduction
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea 
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Enter reason for leave"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={applyLeaveMutation.isPending}>
                {applyLeaveMutation.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Holiday List Dialog */}
      <Dialog open={showHolidayList} onOpenChange={setShowHolidayList}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Holiday Calendar {currentYear}</DialogTitle>
          </DialogHeader>
          <HolidayList year={currentYear} showAllLocations maxHeight="500px" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
