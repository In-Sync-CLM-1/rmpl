import { useState } from "react";
import { useCrmTickets, CrmTicket } from "@/hooks/useCrmTickets";
import { useCrmTicketDetail, TimelineEntry } from "@/hooks/useCrmTicketDetail";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, MessageSquare, AlertTriangle, History } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "awaiting", label: "Awaiting" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const priorityVariant = (p: string | null): "default" | "destructive" | "secondary" | "outline" => {
  switch (p) {
    case "high": case "urgent": return "destructive";
    case "medium": return "default";
    default: return "secondary";
  }
};

const statusVariant = (s: string | null): "default" | "destructive" | "secondary" | "outline" => {
  switch (s) {
    case "new": return "default";
    case "in_progress": return "secondary";
    case "resolved": case "closed": return "outline";
    default: return "secondary";
  }
};

export default function SupportTickets() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<CrmTicket | null>(null);

  const { data, isLoading } = useCrmTickets({ status, search, page, pageSize: 20 });
  const { timeline, isLoading: detailLoading } = useCrmTicketDetail(selectedTicket?.id || null);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const resolutionTime = (ticket: CrmTicket) => {
    if (!ticket.resolved_at || !ticket.created_at) return null;
    return formatDistanceToNow(new Date(ticket.created_at), { addSuffix: false })
      .replace('about ', '');
  };

  const renderTimelineEntry = (entry: TimelineEntry) => {
    const time = entry.created_at ? format(new Date(entry.created_at), "dd MMM yyyy, HH:mm") : "";

    if (entry.type === "comment") {
      return (
        <div key={entry.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
          <MessageSquare className="h-4 w-4 mt-1 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{entry.created_by || "System"}</span>
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
            <p className="text-sm mt-1 text-foreground">{entry.comment}</p>
          </div>
        </div>
      );
    }

    if (entry.type === "escalation") {
      return (
        <div key={entry.id} className="flex gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 mt-1 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Escalated by {entry.escalated_by || "Unknown"}</span>
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
            {entry.escalated_to && <p className="text-xs text-muted-foreground">To: {entry.escalated_to}</p>}
            {entry.remarks && <p className="text-sm mt-1">{entry.remarks}</p>}
          </div>
        </div>
      );
    }

    // history
    return (
      <div key={entry.id} className="flex gap-3 p-3 rounded-lg border border-border">
        <History className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{entry.action || "Change"}</span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {entry.old_value && <span className="line-through mr-2">{entry.old_value}</span>}
            {entry.new_value && <span className="text-foreground">{entry.new_value}</span>}
          </div>
          {entry.changed_by && <p className="text-xs text-muted-foreground mt-0.5">By: {entry.changed_by}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 md:px-6 pb-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
        <p className="text-muted-foreground text-sm">Track and manage your support requests</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <TabsList>
            {STATUS_TABS.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Ticket #</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">Latest Comment</TableHead>
              <TableHead className="w-32">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              data?.tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <TableCell className="font-mono text-xs">{ticket.ticket_number || "—"}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{ticket.subject || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(ticket.priority)} className="text-xs capitalize">
                      {ticket.priority || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(ticket.status)} className="text-xs capitalize">
                      {ticket.status?.replace('_', ' ') || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[150px]">
                    {ticket.contact_name || ticket.contact_email || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[200px]">
                    {ticket.latest_comment || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ticket.created_at ? format(new Date(ticket.created_at), "dd MMM yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({data?.total} tickets)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Side Sheet */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedTicket && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">
                  <span className="font-mono text-sm text-muted-foreground block mb-1">
                    {selectedTicket.ticket_number}
                  </span>
                  {selectedTicket.subject || "No subject"}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Meta */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={priorityVariant(selectedTicket.priority)} className="capitalize">
                    {selectedTicket.priority}
                  </Badge>
                  <Badge variant={statusVariant(selectedTicket.status)} className="capitalize">
                    {selectedTicket.status?.replace('_', ' ')}
                  </Badge>
                  {selectedTicket.category && (
                    <Badge variant="outline">{selectedTicket.category}</Badge>
                  )}
                </div>

                {/* Description */}
                {selectedTicket.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                )}

                {/* Resolution Time */}
                {selectedTicket.resolved_at && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Resolution Time</h4>
                    <p className="text-sm text-muted-foreground">{resolutionTime(selectedTicket)}</p>
                  </div>
                )}

                {/* Contact Info */}
                <div>
                  <h4 className="text-sm font-medium mb-1">Contact</h4>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    {selectedTicket.contact_name && <p>{selectedTicket.contact_name}</p>}
                    {selectedTicket.contact_email && <p>{selectedTicket.contact_email}</p>}
                    {selectedTicket.contact_phone && <p>{selectedTicket.contact_phone}</p>}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Timeline</h4>
                  {detailLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet</p>
                  ) : (
                    <div className="space-y-2">
                      {timeline.map(renderTimelineEntry)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
