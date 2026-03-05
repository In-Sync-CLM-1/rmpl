import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Upload, Search, Edit, Loader2, PlusCircle, MinusCircle, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { LeaveLimitsImport } from "@/components/leave/LeaveLimitsImport";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  sick_leave_limit: number;
  casual_leave_limit: number;
  earned_leave_limit: number;
  compensatory_off_limit: number;
  maternity_leave_limit: number;
  paternity_leave_limit: number;
  sick_leave_balance: number;
  casual_leave_balance: number;
  earned_leave_balance: number;
  compensatory_off_balance: number;
  maternity_leave_balance: number;
  paternity_leave_balance: number;
  profile?: { full_name: string; email: string };
}

interface BalanceAdjustment {
  leave_type: string;
  adjustment_type: 'add' | 'deduct';
  days: number;
  reason: string;
}

const leaveTypeOptions = [
  { value: 'casual_leave', label: 'Casual Leave' },
  { value: 'earned_leave', label: 'Earned Leave' },
  { value: 'compensatory_off', label: 'Compensatory Off' },
  { value: 'maternity_leave', label: 'Maternity Leave' },
  { value: 'paternity_leave', label: 'Paternity Leave' },
];

export default function LeaveLimitsAdmin() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<LeaveBalance | null>(null);
  const [adjustingUser, setAdjustingUser] = useState<LeaveBalance | null>(null);
  const [viewingHistory, setViewingHistory] = useState<LeaveBalance | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [editForm, setEditForm] = useState({
    casual_leave_limit: 12,
    earned_leave_limit: 15,
    compensatory_off_limit: 0,
    maternity_leave_limit: 180,
    paternity_leave_limit: 3,
  });
  const [adjustmentForm, setAdjustmentForm] = useState<BalanceAdjustment>({
    leave_type: 'casual_leave',
    adjustment_type: 'add',
    days: 0,
    reason: '',
  });
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: leaveBalances, isLoading } = useQuery({
    queryKey: ["leave-balances-admin", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("year", selectedYear)
        .order("user_id");

      if (error) throw error;

      // Fetch profiles for names
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(lb => lb.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        return data.map(lb => ({
          ...lb,
          profile: profiles?.find(p => p.id === lb.user_id),
        })) as LeaveBalance[];
      }

      return data as LeaveBalance[];
    },
  });

  const { data: adjustmentHistory } = useQuery({
    queryKey: ["adjustment-history", viewingHistory?.user_id, selectedYear],
    queryFn: async () => {
      if (!viewingHistory?.user_id) return [];
      
      const { data, error } = await supabase
        .from("leave_balance_adjustments")
        .select("*")
        .eq("user_id", viewingHistory.user_id)
        .eq("year", selectedYear)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch adjuster names
      if (data && data.length > 0) {
        const adjusterIds = [...new Set(data.map(a => a.adjusted_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", adjusterIds);

        return data.map(a => ({
          ...a,
          adjuster_name: profiles?.find(p => p.id === a.adjusted_by)?.full_name || 'Unknown',
        }));
      }

      return data || [];
    },
    enabled: !!viewingHistory?.user_id,
  });

  const updateLimitsMutation = useMutation({
    mutationFn: async ({ userId, limits }: { userId: string; limits: typeof editForm }) => {
      const { error } = await supabase
        .from("leave_balances")
        .update({
          casual_leave_limit: limits.casual_leave_limit,
          earned_leave_limit: limits.earned_leave_limit,
          compensatory_off_limit: limits.compensatory_off_limit,
          maternity_leave_limit: limits.maternity_leave_limit,
          paternity_leave_limit: limits.paternity_leave_limit,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("year", selectedYear);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances-admin"] });
      setEditingUser(null);
      toast.success("Leave limits updated successfully!");
    },
    onError: (error: Error) => {
      toast.error("Failed to update limits: " + error.message);
    },
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ userId, adjustment }: { userId: string; adjustment: BalanceAdjustment }) => {
      if (!currentUser?.id) throw new Error("Not authenticated");
      if (!adjustingUser) throw new Error("No user selected");
      if (adjustment.days <= 0) throw new Error("Days must be greater than 0");
      if (!adjustment.reason.trim()) throw new Error("Reason is required");

      const balanceField = `${adjustment.leave_type}_balance` as keyof LeaveBalance;
      const currentBalance = Number(adjustingUser[balanceField]) || 0;
      const newBalance = adjustment.adjustment_type === 'add' 
        ? currentBalance + adjustment.days
        : Math.max(0, currentBalance - adjustment.days);

      // Update balance
      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({ 
          [balanceField]: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("year", selectedYear);

      if (updateError) throw updateError;

      // Log adjustment in audit table
      const { error: auditError } = await supabase
        .from("leave_balance_adjustments")
        .insert({
          user_id: userId,
          adjusted_by: currentUser.id,
          leave_type: adjustment.leave_type,
          adjustment_type: adjustment.adjustment_type,
          days: adjustment.days,
          previous_balance: currentBalance,
          new_balance: newBalance,
          reason: adjustment.reason.trim(),
          year: selectedYear,
        });

      if (auditError) throw auditError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances-admin"] });
      queryClient.invalidateQueries({ queryKey: ["adjustment-history"] });
      setAdjustingUser(null);
      setAdjustmentForm({
        leave_type: 'casual_leave',
        adjustment_type: 'add',
        days: 0,
        reason: '',
      });
      toast.success("Leave balance adjusted successfully!");
    },
    onError: (error: Error) => {
      toast.error("Failed to adjust balance: " + error.message);
    },
  });

  const recalcCompOffMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('recalculate_all_comp_off', {
        p_year: selectedYear,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances-admin"] });
      const count = data?.length || 0;
      toast.success(`Comp-off recalculated for ${count} employees`);
    },
    onError: (error: Error) => {
      toast.error("Failed to recalculate comp-off: " + error.message);
    },
  });

  const handleRecalcCompOff = () => {
    recalcCompOffMutation.mutate();
  };

  const handleEdit = (balance: LeaveBalance) => {
    setEditingUser(balance);
    setEditForm({
      casual_leave_limit: balance.casual_leave_limit || 12,
      earned_leave_limit: balance.earned_leave_limit || 15,
      compensatory_off_limit: balance.compensatory_off_limit || 0,
      maternity_leave_limit: balance.maternity_leave_limit || 180,
      paternity_leave_limit: balance.paternity_leave_limit || 3,
    });
  };

  const handleAdjust = (balance: LeaveBalance) => {
    setAdjustingUser(balance);
    setAdjustmentForm({
      leave_type: 'casual_leave',
      adjustment_type: 'add',
      days: 0,
      reason: '',
    });
  };

  const handleSave = () => {
    if (!editingUser) return;
    updateLimitsMutation.mutate({ userId: editingUser.user_id, limits: editForm });
  };

  const handleSaveAdjustment = () => {
    if (!adjustingUser) return;
    adjustBalanceMutation.mutate({ userId: adjustingUser.user_id, adjustment: adjustmentForm });
  };

  const filteredBalances = leaveBalances?.filter(lb => {
    if (!searchTerm) return true;
    const name = lb.profile?.full_name?.toLowerCase() || "";
    const email = lb.profile?.email?.toLowerCase() || "";
    return name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
  });

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const getLeaveTypeLabel = (type: string) => {
    return leaveTypeOptions.find(o => o.value === type)?.label || type;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Leave Limits Management
          </h1>
          <p className="text-muted-foreground">Configure leave limits and adjust balances for employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRecalcCompOff} disabled={recalcCompOffMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${recalcCompOffMutation.isPending ? 'animate-spin' : ''}`} />
            {recalcCompOffMutation.isPending ? 'Recalculating...' : 'Recalculate Comp Off'}
          </Button>
          <Button onClick={() => setShowImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import Limits
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Employee Leave Limits & Balances</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    
                    <TableHead className="text-center">CL</TableHead>
                    <TableHead className="text-center">EL</TableHead>
                    <TableHead className="text-center">Comp Off</TableHead>
                    <TableHead className="text-center">Mat. Leave</TableHead>
                    <TableHead className="text-center">Pat. Leave</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBalances?.map((balance) => (
                    <TableRow key={balance.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{balance.profile?.full_name || "Unknown"}</div>
                          <div className="text-sm text-muted-foreground">{balance.profile?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Limit: {balance.casual_leave_limit || 12}</span>
                          <span className="font-semibold">{balance.casual_leave_balance || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Limit: {balance.earned_leave_limit || 15}</span>
                          <span className="font-semibold">{balance.earned_leave_balance || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Limit: {balance.compensatory_off_limit || 0}</span>
                          <span className="font-semibold">{balance.compensatory_off_balance || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Limit: {balance.maternity_leave_limit || 0}</span>
                          <span className="font-semibold">{balance.maternity_leave_balance || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Limit: {balance.paternity_leave_limit || 0}</span>
                          <span className="font-semibold">{balance.paternity_leave_balance || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(balance)} title="Edit Limits">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleAdjust(balance)} title="Adjust Balance">
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setViewingHistory(balance)} title="View History">
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredBalances?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No employees found for {selectedYear}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Limits Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Leave Limits - {editingUser?.profile?.full_name}
            </DialogTitle>
            <DialogDescription>
              Update annual leave limits for this employee
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Casual Leave Limit</Label>
              <Input
                type="number"
                value={editForm.casual_leave_limit}
                onChange={(e) => setEditForm({ ...editForm, casual_leave_limit: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Earned Leave Limit</Label>
              <Input
                type="number"
                value={editForm.earned_leave_limit}
                onChange={(e) => setEditForm({ ...editForm, earned_leave_limit: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Compensatory Off Limit</Label>
              <Input
                type="number"
                value={editForm.compensatory_off_limit}
                onChange={(e) => setEditForm({ ...editForm, compensatory_off_limit: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Maternity Leave Limit</Label>
              <Input
                type="number"
                value={editForm.maternity_leave_limit}
                onChange={(e) => setEditForm({ ...editForm, maternity_leave_limit: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Paternity Leave Limit</Label>
              <Input
                type="number"
                value={editForm.paternity_leave_limit}
                onChange={(e) => setEditForm({ ...editForm, paternity_leave_limit: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateLimitsMutation.isPending}>
              {updateLimitsMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance Adjustment Dialog */}
      <Dialog open={!!adjustingUser} onOpenChange={() => setAdjustingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustmentForm.adjustment_type === 'add' ? (
                <PlusCircle className="h-5 w-5 text-green-600" />
              ) : (
                <MinusCircle className="h-5 w-5 text-red-600" />
              )}
              Adjust Leave Balance - {adjustingUser?.profile?.full_name}
            </DialogTitle>
            <DialogDescription>
              Add or deduct leave days from this employee's balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select 
                  value={adjustmentForm.leave_type} 
                  onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, leave_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select 
                  value={adjustmentForm.adjustment_type} 
                  onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: v as 'add' | 'deduct' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">
                      <span className="flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-green-600" />
                        Add Days
                      </span>
                    </SelectItem>
                    <SelectItem value="deduct">
                      <span className="flex items-center gap-2">
                        <MinusCircle className="h-4 w-4 text-red-600" />
                        Deduct Days
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Show current balance */}
            {adjustingUser && (
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Current Balance</div>
                <div className="text-lg font-semibold">
                  {Number(adjustingUser[`${adjustmentForm.leave_type}_balance` as keyof LeaveBalance]) || 0} days
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Days</Label>
              <Input 
                type="number" 
                min="0.5" 
                step="0.5"
                placeholder="Enter number of days"
                value={adjustmentForm.days || ''}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea 
                placeholder="Enter reason for adjustment (required)"
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustingUser(null)}>Cancel</Button>
            <Button 
              onClick={handleSaveAdjustment} 
              disabled={adjustBalanceMutation.isPending || adjustmentForm.days <= 0 || !adjustmentForm.reason.trim()}
              variant={adjustmentForm.adjustment_type === 'deduct' ? 'destructive' : 'default'}
            >
              {adjustBalanceMutation.isPending ? "Saving..." : (
                adjustmentForm.adjustment_type === 'add' ? 'Add Days' : 'Deduct Days'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment History Dialog */}
      <Dialog open={!!viewingHistory} onOpenChange={() => setViewingHistory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Adjustment History - {viewingHistory?.profile?.full_name}
            </DialogTitle>
            <DialogDescription>
              View all balance adjustments for {selectedYear}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {adjustmentHistory && adjustmentHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustmentHistory.map((adj: any) => (
                    <TableRow key={adj.id}>
                      <TableCell className="text-sm">
                        {format(new Date(adj.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getLeaveTypeLabel(adj.leave_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={adj.adjustment_type === 'add' ? 'default' : 'destructive'}>
                          {adj.adjustment_type === 'add' ? '+' : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {adj.days}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {adj.adjuster_name}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={adj.reason}>
                        {adj.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No adjustments found for {selectedYear}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingHistory(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Leave Limits</DialogTitle>
          </DialogHeader>
          <LeaveLimitsImport year={selectedYear} onClose={() => setShowImport(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
