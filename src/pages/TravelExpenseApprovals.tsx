import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, XCircle, User, Calendar, MapPin, ExternalLink, ShieldCheck, Receipt } from "lucide-react";
import { format } from "date-fns";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  useCurrentUser,
  usePendingApprovals,
  useAllApprovals,
  useApproveClaim,
  useRejectClaim,
  getExpenseTypeLabel,
  getStatusColor,
  getStatusLabel,
  type ExpenseClaim,
} from "@/hooks/useExpenseClaims";

export default function TravelExpenseApprovals() {
  const { data: user } = useCurrentUser();
  const { permissions } = useUserPermissions();
  const isAdmin = permissions.canViewUsers; // admin check

  const { data: pending, isLoading: pendingLoading } = usePendingApprovals(user?.id);
  const { data: allClaims, isLoading: allLoading } = useAllApprovals(user?.id, isAdmin);

  const [rejectDialogClaim, setRejectDialogClaim] = useState<ExpenseClaim | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveDialogClaim, setApproveDialogClaim] = useState<ExpenseClaim | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");

  const approveMutation = useApproveClaim();
  const rejectMutation = useRejectClaim();

  const handleApprove = async () => {
    if (!approveDialogClaim || !user) return;
    await approveMutation.mutateAsync({
      claimId: approveDialogClaim.id,
      approverId: user.id,
      approvedAmount: approvedAmount ? parseFloat(approvedAmount) : Number(approveDialogClaim.total_amount),
    });
    setApproveDialogClaim(null);
    setApprovedAmount("");
  };

  const handleReject = async () => {
    if (!rejectDialogClaim || !user || !rejectReason.trim()) return;
    await rejectMutation.mutateAsync({
      claimId: rejectDialogClaim.id,
      approverId: user.id,
      reason: rejectReason,
    });
    setRejectDialogClaim(null);
    setRejectReason("");
  };

  const historyClaims = allClaims?.filter((c) => c.status !== "submitted") || [];

  if (!pendingLoading && !pending?.length && !allClaims?.length) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" />
          Expense Approvals
        </h1>
        <p className="text-muted-foreground mb-8">Review and approve expense claims from your team</p>
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500/30 mb-3" />
            <p className="text-muted-foreground">No pending expense claims to review</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" />
          Expense Approvals
        </h1>
        <p className="text-muted-foreground">Review and approve expense claims from your team</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="flex gap-2">
            Pending
            {(pending?.length || 0) > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">{pending?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !pending?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500/30 mb-3" />
                <p className="text-muted-foreground">All caught up! No pending approvals.</p>
              </CardContent>
            </Card>
          ) : (
            pending.map((claim) => (
              <ApprovalCard
                key={claim.id}
                claim={claim}
                onApprove={() => {
                  setApproveDialogClaim(claim);
                  setApprovedAmount(String(Number(claim.total_amount)));
                }}
                onReject={() => setRejectDialogClaim(claim)}
              />
            ))
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {allLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !historyClaims.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No history yet</CardContent>
            </Card>
          ) : (
            historyClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{claim.trip_title}</span>
                    <Badge variant={getStatusColor(claim.status)}>{getStatusLabel(claim.status)}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {claim.profiles?.full_name} · {claim.destination || ""}
                    {claim.destination && " · "}
                    {format(new Date(claim.trip_start_date), "MMM d")} — {format(new Date(claim.trip_end_date), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-bold">₹{Number(claim.total_amount).toLocaleString("en-IN")}</div>
                  {claim.approved_amount != null && (
                    <div className="text-xs text-green-600">
                      Approved: ₹{Number(claim.approved_amount).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialogClaim} onOpenChange={(open) => { if (!open) setApproveDialogClaim(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Expense Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{approveDialogClaim?.trip_title}</strong> by {approveDialogClaim?.profiles?.full_name}
            </p>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span>Claimed Amount</span>
              <span className="font-bold">₹{Number(approveDialogClaim?.total_amount || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="space-y-2">
              <Label>Approved Amount (₹)</Label>
              <Input
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                placeholder="Enter approved amount"
              />
              <p className="text-xs text-muted-foreground">
                Leave as-is to approve the full amount, or adjust if needed
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogClaim(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialogClaim} onOpenChange={(open) => { if (!open) setRejectDialogClaim(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{rejectDialogClaim?.trip_title}</strong> by {rejectDialogClaim?.profiles?.full_name}
              <br />
              Amount: ₹{Number(rejectDialogClaim?.total_amount || 0).toLocaleString("en-IN")}
            </p>
            <div className="space-y-2">
              <Label>Reason for Rejection *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejection"
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogClaim(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending || !rejectReason.trim()}>
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalCard({
  claim,
  onApprove,
  onReject,
}: {
  claim: ExpenseClaim;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{claim.trip_title}</h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{claim.profiles?.full_name}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(claim.trip_start_date), "MMM d")} — {format(new Date(claim.trip_end_date), "MMM d, yyyy")}
              </span>
              {claim.destination && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{claim.destination}</span>
              )}
            </div>
            {claim.purpose && <p className="text-sm text-muted-foreground mt-1">{claim.purpose}</p>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">₹{Number(claim.total_amount).toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground">{claim.items?.length || 0} items</p>
          </div>
        </div>

        {/* Expandable items */}
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide" : "View"} expense details
        </Button>

        {expanded && claim.items && (
          <div className="space-y-2 pl-2 border-l-2 border-muted">
            {claim.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1">
                <div>
                  <Badge variant="outline" className="text-xs mr-2">{getExpenseTypeLabel(item.expense_type)}</Badge>
                  <span className="text-muted-foreground">{item.description}</span>
                  {item.receipt_url && (
                    <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 inline-flex items-center gap-0.5">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <span className="font-medium whitespace-nowrap">₹{Number(item.amount).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onReject}>
            <XCircle className="h-4 w-4 mr-1" /> Reject
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckCircle className="h-4 w-4 mr-1" /> Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
