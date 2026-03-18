import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const LEAVE_TYPES = {
  casual_leave: "Casual Leave",
  earned_leave: "Earned Leave",
  unpaid_leave: "Unpaid Leave",
  compensatory_off: "Compensatory Off",
  maternity_leave: "Maternity Leave",
  paternity_leave: "Paternity Leave",
};

export default function LeaveApprovals() {
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissions();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return data?.map(r => r.role) || [];
    },
    enabled: !!user?.id,
  });

  const isHRAdmin = permissions.canOverrideLeaveApprovals;

  const { data: canApprove, isLoading: checkingPermission } = useQuery({
    queryKey: ["can-approve-leaves", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const isHR = roles?.some(r => r.role === 'hr_manager') || false;
      if (isHR) return true;
      
      const { data: subordinates } = await supabase
        .from("profiles")
        .select("id")
        .eq("reports_to", user.id)
        .limit(1);
      
      return subordinates && subordinates.length > 0;
    },
    enabled: !!user?.id,
  });

  const { data: pendingLeaves } = useQuery({
    queryKey: ["pending-leaves", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: subordinates } = await supabase
        .from("profiles")
        .select("id")
        .eq("reports_to", user.id);
      
      const subordinateIds = subordinates?.map(s => s.id) || [];
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const isHR = roles?.some(r => r.role === 'hr_manager') || false;
      
      let query = supabase
        .from("leave_applications")
        .select("*")
        .eq("status", "pending" as any)
        .order("applied_at", { ascending: false });
      
      if (!isHR && subordinateIds.length > 0) {
        query = query.in("user_id", subordinateIds);
      } else if (!isHR) {
        return [];
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((l: any) => l.user_id))];
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, reports_to")
          .in("id", userIds);

        // Get manager names
        const managerIds = profiles?.map(p => p.reports_to).filter(Boolean) || [];
        const { data: managers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", managerIds);
        
        const currentYear = new Date().getFullYear();
        const { data: balances } = await supabase
          .from("leave_balances")
          .select("*")
          .in("user_id", userIds)
          .eq("year", currentYear);
        
        return data.map((leave: any) => {
          const profile = profiles?.find(p => p.id === leave.user_id);
          const manager = managers?.find(m => m.id === profile?.reports_to);
          const daysPending = differenceInDays(new Date(), new Date(leave.applied_at));
          
          return {
            ...leave,
            profile: profile || { full_name: "Unknown", email: "" },
            manager: manager || null,
            balance: balances?.find(b => b.user_id === leave.user_id) || null,
            daysPending,
            needsHROverride: daysPending > 3 && !isHR,
          };
        }) as any[];
      }
      
      return data || [];
    },
    enabled: !!user?.id && canApprove === true,
  });

  // Fetch stale leaves (pending > 3 days) for HR override
  const { data: staleLeaves } = useQuery({
    queryKey: ["stale-leaves"],
    queryFn: async () => {
      if (!isHRAdmin) return [];
      
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { data, error } = await supabase
        .from("leave_applications")
        .select("*")
        .eq("status", "pending" as any)
        .lt("applied_at", threeDaysAgo.toISOString())
        .order("applied_at", { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((l: any) => l.user_id))];
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, reports_to")
          .in("id", userIds);

        const managerIds = profiles?.map(p => p.reports_to).filter(Boolean) || [];
        const { data: managers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", managerIds);
        
        const currentYear = new Date().getFullYear();
        const { data: balances } = await supabase
          .from("leave_balances")
          .select("*")
          .in("user_id", userIds)
          .eq("year", currentYear);
        
        return data.map((leave: any) => {
          const profile = profiles?.find(p => p.id === leave.user_id);
          const manager = managers?.find(m => m.id === profile?.reports_to);
          const daysPending = differenceInDays(new Date(), new Date(leave.applied_at));
          
          return {
            ...leave,
            profile: profile || { full_name: "Unknown", email: "" },
            manager: manager || null,
            balance: balances?.find(b => b.user_id === leave.user_id) || null,
            daysPending,
          };
        }) as any[];
      }
      
      return [];
    },
    enabled: isHRAdmin,
  });

  const getBalanceInfo = (leave: any) => {
    if (!leave.balance) return null;
    
    const balanceKeyMap: Record<string, { balanceKey: string; limitKey: string }> = {
      casual_leave: { balanceKey: "casual_leave_balance", limitKey: "casual_leave_limit" },
      earned_leave: { balanceKey: "earned_leave_balance", limitKey: "earned_leave_limit" },
      compensatory_off: { balanceKey: "compensatory_off_balance", limitKey: "compensatory_off_limit" },
      maternity_leave: { balanceKey: "maternity_leave_balance", limitKey: "maternity_leave_limit" },
      paternity_leave: { balanceKey: "paternity_leave_balance", limitKey: "paternity_leave_limit" },
    };

    const keys = balanceKeyMap[leave.leave_type];
    if (!keys) return null;

    const balance = leave.balance[keys.balanceKey] || 0;
    const limit = leave.balance[keys.limitKey] || 0;
    const remaining = balance - leave.total_days;

    return { balance, limit, remaining };
  };

  const approveLeaveMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      if (!user?.id) throw new Error("User not found");

      // Guard against re-approval
      const { data: current } = await supabase
        .from("leave_applications")
        .select("status")
        .eq("id", leaveId)
        .single();

      if (current?.status !== 'pending') {
        throw new Error("This leave has already been processed.");
      }
      
      const { error } = await supabase
        .from("leave_applications")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", leaveId)
        .eq("status", "pending" as any);
      
      if (error) throw error;
    },
    onSuccess: async (_data, leaveId) => {
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      setSelectedLeave(null);
      toast.success("Leave approved successfully!");

      // Send employee notification email
      try {
        const leave = pendingLeaves?.find((l: any) => l.id === leaveId) || staleLeaves?.find((l: any) => l.id === leaveId);
        if (leave?.profile?.email) {
          const approverProfile = user?.email;
          await supabase.functions.invoke("send-approval-email", {
            body: {
              notification_type: "result",
              request_type: "leave",
              employee_name: leave.profile.full_name,
              employee_email: leave.profile.email,
              approver_name: "HR/Manager",
              status: "approved",
              leave_type: leave.leave_type,
              start_date: leave.start_date,
              end_date: leave.end_date,
              total_days: leave.total_days,
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send employee notification:", emailErr);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to approve leave: " + error.message);
    },
  });

  const rejectLeaveMutation = useMutation({
    mutationFn: async ({ leaveId, reason }: { leaveId: string; reason: string }) => {
      if (!user?.id) throw new Error("User not found");
      
      const { error } = await supabase
        .from("leave_applications")
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", leaveId);
      
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      const leave = selectedLeave;
      setSelectedLeave(null);
      setRejectionReason("");
      toast.success("Leave rejected!");

      // Send employee notification email
      try {
        if (leave?.profile?.email) {
          await supabase.functions.invoke("send-approval-email", {
            body: {
              notification_type: "result",
              request_type: "leave",
              employee_name: leave.profile.full_name,
              employee_email: leave.profile.email,
              approver_name: "HR/Manager",
              status: "rejected",
              leave_type: leave.leave_type,
              start_date: leave.start_date,
              end_date: leave.end_date,
              total_days: leave.total_days,
              rejection_reason: variables.reason,
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send employee notification:", emailErr);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to reject leave: " + error.message);
    },
  });

  if (checkingPermission) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canApprove) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to approve leave applications.
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
          <h1 className="text-3xl font-bold">Leave Approvals</h1>
          <p className="text-muted-foreground">Review and approve pending leave applications</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Clock className="mr-2 h-4 w-4" />
          {pendingLeaves?.length || 0} Pending
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending Approvals ({pendingLeaves?.length || 0})
          </TabsTrigger>
          {isHRAdmin && (
            <TabsTrigger value="stale" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              HR Override ({staleLeaves?.length || 0})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <div className="grid gap-4">
            {pendingLeaves?.map((leave) => (
              <LeaveCard 
                key={leave.id} 
                leave={leave} 
                onApprove={() => approveLeaveMutation.mutate(leave.id)}
                onReject={() => setSelectedLeave(leave)}
                isApproving={approveLeaveMutation.isPending}
                showHRBadge={false}
                getBalanceInfo={getBalanceInfo}
              />
            ))}
            
            {!pendingLeaves?.length && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Pending Leave Applications</h3>
                  <p className="text-muted-foreground">There are no pending leave applications awaiting your approval</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {isHRAdmin && (
          <TabsContent value="stale" className="space-y-4">
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">HR Override Mode</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      These leave applications have been pending for more than 3 days without manager action. 
                      As an HR Admin, you can approve or reject them on behalf of the manager.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {staleLeaves?.map((leave) => (
                <LeaveCard 
                  key={leave.id} 
                  leave={leave} 
                  onApprove={() => approveLeaveMutation.mutate(leave.id)}
                  onReject={() => setSelectedLeave(leave)}
                  isApproving={approveLeaveMutation.isPending}
                  showHRBadge={true}
                  getBalanceInfo={getBalanceInfo}
                />
              ))}
              
              {!staleLeaves?.length && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                    <p className="text-muted-foreground">No leave applications require HR override at this time</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!selectedLeave} onOpenChange={() => setSelectedLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Rejection</Label>
              <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter reason for rejection..." className="mt-2" rows={4} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setSelectedLeave(null); setRejectionReason(""); }} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={() => rejectLeaveMutation.mutate({ leaveId: selectedLeave?.id, reason: rejectionReason })} disabled={!rejectionReason || rejectLeaveMutation.isPending} className="flex-1">Confirm Rejection</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// LeaveCard component
function LeaveCard({ 
  leave, 
  onApprove, 
  onReject, 
  isApproving, 
  showHRBadge,
  getBalanceInfo 
}: { 
  leave: any; 
  onApprove: () => void; 
  onReject: () => void; 
  isApproving: boolean;
  showHRBadge: boolean;
  getBalanceInfo: (leave: any) => { balance: number; limit: number; remaining: number } | null;
}) {
  const LEAVE_TYPES: Record<string, string> = {
    casual_leave: "Casual Leave",
    earned_leave: "Earned Leave",
    unpaid_leave: "Unpaid Leave",
    compensatory_off: "Compensatory Off",
    maternity_leave: "Maternity Leave",
    paternity_leave: "Paternity Leave",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{leave.profile?.full_name || "Unknown User"}</CardTitle>
            <p className="text-sm text-muted-foreground">{leave.profile?.email}</p>
            {leave.manager && (
              <p className="text-sm text-muted-foreground mt-1">
                Reports to: <span className="font-medium">{leave.manager.full_name}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {showHRBadge && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {leave.daysPending} days pending
              </Badge>
            )}
            <Badge variant="secondary">
              {LEAVE_TYPES[leave.leave_type as keyof typeof LEAVE_TYPES]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-semibold">
              {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Days:</span>
            <span className="font-semibold">{leave.total_days} days</span>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <Label className="text-sm text-muted-foreground">Reason:</Label>
          <p className="mt-1">{leave.reason}</p>
        </div>

        {(() => {
          const balanceInfo = getBalanceInfo(leave);
          if (!balanceInfo) return null;
          const isNegative = balanceInfo.remaining < 0;
          return (
            <div className={`p-3 rounded-lg ${isNegative ? "bg-destructive/10 border border-destructive" : "bg-muted"}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className="font-semibold">{balanceInfo.balance} / {balanceInfo.limit}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">After Approval:</span>
                <span className={`font-semibold ${isNegative ? "text-destructive" : "text-green-600"}`}>
                  {balanceInfo.remaining} / {balanceInfo.limit}
                </span>
              </div>
            </div>
          );
        })()}

        <div className="flex gap-2 pt-2">
          <Button onClick={onApprove} disabled={isApproving} className="flex-1">
            <CheckCircle className="mr-2 h-4 w-4" />
            {showHRBadge ? "HR Approve" : "Approve"}
          </Button>
          <Button variant="destructive" onClick={onReject} className="flex-1">
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
