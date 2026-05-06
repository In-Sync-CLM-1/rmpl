import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Wallet, Download, CheckCircle2, Search, IndianRupee, Receipt, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  useCurrentUser,
  useApprovedForPayment,
  useReimbursedClaims,
  useMarkReimbursed,
  useExpenseClaimDetail,
  getStatusColor,
  getStatusLabel,
  type ExpenseClaim,
} from "@/hooks/useExpenseClaims";
import { ExpenseClaimDetail } from "@/components/expenses/ExpenseClaimDetail";

type Tab = "pending" | "history";

export default function ExpenseReimbursement() {
  const { data: user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const { data: pending, isLoading: pendingLoading } = useApprovedForPayment();
  const { data: history, isLoading: historyLoading } = useReimbursedClaims();
  const { data: drilldown } = useExpenseClaimDetail(selectedClaimId || undefined);
  const markReimbursed = useMarkReimbursed();

  const claims = tab === "pending" ? pending : history;
  const isLoading = tab === "pending" ? pendingLoading : historyLoading;

  const filtered = useMemo(() => {
    if (!claims) return [];
    if (!search.trim()) return claims;
    const q = search.toLowerCase();
    return claims.filter(
      (c) =>
        c.trip_title?.toLowerCase().includes(q) ||
        c.profiles?.full_name?.toLowerCase().includes(q) ||
        c.destination?.toLowerCase().includes(q) ||
        c.projects?.project_name?.toLowerCase().includes(q),
    );
  }, [claims, search]);

  const totals = useMemo(() => {
    const pendingAmt = (pending || []).reduce(
      (sum, c) => sum + Number(c.approved_amount ?? c.total_amount ?? 0),
      0,
    );
    const historyAmt = (history || []).reduce(
      (sum, c) => sum + Number(c.approved_amount ?? c.total_amount ?? 0),
      0,
    );
    return { pendingAmt, historyAmt };
  }, [pending, history]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someFilteredSelected = filtered.some((c) => selected.has(c.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const c of filtered) next.delete(c.id);
      } else {
        for (const c of filtered) next.add(c.id);
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotal = (pending || [])
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + Number(c.approved_amount ?? c.total_amount ?? 0), 0);

  const handleConfirmMark = async () => {
    if (!user) return;
    await markReimbursed.mutateAsync({ claimIds: Array.from(selected), userId: user.id });
    setSelected(new Set());
    setConfirmOpen(false);
  };

  const handleExport = () => {
    const rows = filtered;
    if (rows.length === 0) return;
    const headers = [
      "Claim ID",
      "Employee",
      "Email",
      "Trip Title",
      "Destination",
      "Project",
      "Trip Start",
      "Trip End",
      "Approved On",
      "Claimed Amount (INR)",
      "Approved Amount (INR)",
      "Status",
      tab === "history" ? "Reimbursed On" : "",
    ].filter(Boolean);

    const escape = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes("\n") || s.includes('"')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csvRows = rows.map((c) => {
      const base = [
        c.id,
        c.profiles?.full_name || "",
        c.profiles?.email || "",
        c.trip_title,
        c.destination || "",
        c.projects?.project_name || "",
        c.trip_start_date,
        c.trip_end_date,
        c.approved_at ? format(new Date(c.approved_at), "yyyy-MM-dd") : "",
        Number(c.total_amount || 0),
        Number(c.approved_amount ?? c.total_amount ?? 0),
        getStatusLabel(c.status),
      ];
      if (tab === "history") {
        base.push(c.reimbursed_at ? format(new Date(c.reimbursed_at), "yyyy-MM-dd") : "");
      }
      return base.map(escape).join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reimbursements-${tab}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wallet className="h-7 w-7" />
          Reimbursements
        </h1>
        <p className="text-muted-foreground">
          Approved expense claims awaiting payment by accounts
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className={pending && pending.length > 0 ? "border-yellow-300" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Pending Payment</span>
            </div>
            <div className="text-3xl font-bold">{pending?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              ₹{totals.pendingAmt.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Reimbursed (last 200)</span>
            </div>
            <div className="text-3xl font-bold">{history?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              ₹{totals.historyAmt.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Selected</span>
            </div>
            <div className="text-3xl font-bold">{selected.size}</div>
            <p className="text-xs text-muted-foreground">
              ₹{selectedTotal.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex flex-col gap-2">
            <Button
              size="sm"
              disabled={selected.size === 0 || markReimbursed.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark Selected as Reimbursed
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setSelected(new Set()); }}>
              <TabsList>
                <TabsTrigger value="pending" className="flex gap-2">
                  Pending Payment
                  {(pending?.length || 0) > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
                      {pending?.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee, trip, project…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tab === "pending" ? (
            <ClaimsTable
              rows={filtered}
              isLoading={isLoading}
              showSelection
              allSelected={allFilteredSelected}
              indeterminate={!allFilteredSelected && someFilteredSelected}
              selected={selected}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onRowClick={setSelectedClaimId}
              tab="pending"
              emptyText="No claims awaiting payment."
            />
          ) : (
            <ClaimsTable
              rows={filtered}
              isLoading={isLoading}
              showSelection={false}
              onRowClick={setSelectedClaimId}
              tab="history"
              emptyText="No reimbursements recorded yet."
            />
          )}
        </CardContent>
      </Card>

      {/* Drill-down dialog (read-only for accounts) */}
      <ExpenseClaimDetail
        claim={drilldown || null}
        open={!!selectedClaimId}
        onOpenChange={(open) => { if (!open) setSelectedClaimId(null); }}
        isOwner={false}
      />

      {/* Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark selected claims as reimbursed?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to mark <strong>{selected.size}</strong> claim{selected.size === 1 ? "" : "s"} totalling{" "}
              <strong>₹{selectedTotal.toLocaleString("en-IN")}</strong> as reimbursed.
              This records you as the processor and moves them to History.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMark} disabled={markReimbursed.isPending}>
              {markReimbursed.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ClaimsTableProps {
  rows: ExpenseClaim[];
  isLoading: boolean;
  showSelection: boolean;
  allSelected?: boolean;
  indeterminate?: boolean;
  selected?: Set<string>;
  onToggleAll?: () => void;
  onToggleOne?: (id: string) => void;
  onRowClick: (id: string) => void;
  tab: Tab;
  emptyText: string;
}

function ClaimsTable({
  rows,
  isLoading,
  showSelection,
  allSelected,
  indeterminate,
  selected,
  onToggleAll,
  onToggleOne,
  onRowClick,
  tab,
  emptyText,
}: ClaimsTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <IndianRupee className="h-12 w-12 mx-auto opacity-30 mb-3" />
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection && (
              <TableHead className="w-10">
                <Checkbox
                  checked={indeterminate ? "indeterminate" : allSelected}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Employee</TableHead>
            <TableHead>Trip / Purpose</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Approved On</TableHead>
            {tab === "history" && <TableHead>Reimbursed On</TableHead>}
            <TableHead className="text-right">Approved (₹)</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const amount = Number(c.approved_amount ?? c.total_amount ?? 0);
            return (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => onRowClick(c.id)}
              >
                {showSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected?.has(c.id) || false}
                      onCheckedChange={() => onToggleOne?.(c.id)}
                      aria-label="Select claim"
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="font-medium">{c.profiles?.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.profiles?.email}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{c.trip_title}</div>
                  {c.destination && (
                    <div className="text-xs text-muted-foreground">{c.destination}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {c.projects?.project_name || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {c.approved_at ? format(new Date(c.approved_at), "dd MMM yyyy") : "—"}
                </TableCell>
                {tab === "history" && (
                  <TableCell className="text-sm">
                    {c.reimbursed_at ? format(new Date(c.reimbursed_at), "dd MMM yyyy") : "—"}
                  </TableCell>
                )}
                <TableCell className="text-right font-semibold">
                  ₹{amount.toLocaleString("en-IN")}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(c.status)}>{getStatusLabel(c.status)}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
