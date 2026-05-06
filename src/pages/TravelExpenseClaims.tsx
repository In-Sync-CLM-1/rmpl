import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Receipt, Wallet, Clock, CheckCircle2, XCircle, IndianRupee, Plane } from "lucide-react";
import { format } from "date-fns";
import {
  useCurrentUser,
  useExpenseClaims,
  useExpenseClaimDetail,
  getStatusColor,
  getStatusLabel,
  type ExpenseClaim,
} from "@/hooks/useExpenseClaims";
import { ExpenseClaimDialog } from "@/components/expenses/ExpenseClaimDialog";
import { ExpenseClaimDetail } from "@/components/expenses/ExpenseClaimDetail";

export default function TravelExpenseClaims() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: user } = useCurrentUser();
  const { data: claims, isLoading } = useExpenseClaims(user?.id);
  const { data: selectedClaim } = useExpenseClaimDetail(selectedClaimId || undefined);

  const filteredClaims = claims?.filter((c) => statusFilter === "all" || c.status === statusFilter) || [];

  // Summary stats
  const stats = {
    total: claims?.length || 0,
    pending: claims?.filter((c) => c.status === "submitted").length || 0,
    approved: claims?.filter((c) => c.status === "approved" || c.status === "reimbursed").length || 0,
    totalAmount: claims?.reduce((sum, c) => sum + Number(c.total_amount || 0), 0) || 0,
    pendingAmount: claims?.filter((c) => c.status === "submitted").reduce((sum, c) => sum + Number(c.total_amount || 0), 0) || 0,
    approvedAmount: claims
      ?.filter((c) => c.status === "approved" || c.status === "reimbursed")
      .reduce((sum, c) => sum + Number(c.approved_amount || c.total_amount || 0), 0) || 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plane className="h-7 w-7" />
            Expense Claim
          </h1>
          <p className="text-muted-foreground">Submit and track your expense claims</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          New Expense Claim
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Total Claims</span>
            </div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className={stats.pending > 0 ? "border-yellow-300" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-3xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">₹{stats.pendingAmount.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Approved</span>
            </div>
            <div className="text-3xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">₹{stats.approvedAmount.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Total Claimed</span>
            </div>
            <div className="text-3xl font-bold">₹{stats.totalAmount.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & List */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            My Claims
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="submitted">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="reimbursed">Reimbursed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No expense claims found</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create your first claim
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClaims.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  onClick={() => setSelectedClaimId(claim.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {user && (
        <ExpenseClaimDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          userId={user.id}
        />
      )}
      <ExpenseClaimDetail
        claim={selectedClaim || null}
        open={!!selectedClaimId}
        onOpenChange={(open) => { if (!open) setSelectedClaimId(null); }}
        isOwner
      />
    </div>
  );
}

function ClaimRow({ claim, onClick }: { claim: ExpenseClaim; onClick: () => void }) {
  return (
    <div
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{claim.trip_title}</span>
          <Badge variant={getStatusColor(claim.status)}>{getStatusLabel(claim.status)}</Badge>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {claim.destination && <span>{claim.destination} · </span>}
          {format(new Date(claim.trip_start_date), "MMM d")} — {format(new Date(claim.trip_end_date), "MMM d, yyyy")}
        </div>
        {claim.projects && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Project: {claim.projects.project_name}
          </div>
        )}
      </div>
      <div className="text-right ml-4">
        <div className="font-bold text-lg">₹{Number(claim.total_amount).toLocaleString("en-IN")}</div>
        {claim.submitted_at && (
          <div className="text-xs text-muted-foreground">
            {format(new Date(claim.submitted_at), "MMM d, yyyy")}
          </div>
        )}
      </div>
    </div>
  );
}
