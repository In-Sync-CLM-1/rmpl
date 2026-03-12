import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CheckCircle2,
  Circle,
  Clock,
  UserCheck,
  Loader2,
  MessageSquare,
  ArrowRight,
  AlertCircle,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import rmplLogo from "@/assets/rmpl-logo.png";

const TICKET_API = "https://knuewnenaswscgaldjej.supabase.co/functions/v1";

type TicketStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "awaiting_client"
  | "resolved"
  | "closed";

interface Ticket {
  ticket_number: string;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority?: string;
  category?: string;
  created_at: string;
  updated_at?: string;
  assigned_to?: string;
  resolved_at?: string;
  contact_name?: string;
  contact_email?: string;
}

interface HistoryEntry {
  id: string;
  action: string;
  old_value?: string;
  new_value?: string;
  changed_by?: string;
  created_at: string;
  comment?: string;
}

const STATUS_ORDER: TicketStatus[] = [
  "new",
  "assigned",
  "in_progress",
  "awaiting_client",
  "resolved",
  "closed",
];

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; color: string; icon: typeof Circle }
> = {
  new: { label: "New", color: "bg-blue-500", icon: Circle },
  assigned: { label: "Assigned", color: "bg-indigo-500", icon: UserCheck },
  in_progress: { label: "In Progress", color: "bg-yellow-500", icon: Clock },
  awaiting_client: {
    label: "Awaiting Client",
    color: "bg-orange-500",
    icon: MessageSquare,
  },
  resolved: { label: "Resolved", color: "bg-green-500", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-gray-500", icon: XCircle },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function TicketTracker() {
  const [ticketNumber, setTicketNumber] = useState("");
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [closed, setClosed] = useState(false);

  const fetchStatus = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ticketNumber.trim() || !email.trim()) return;

    setLoading(true);
    setError("");
    setTicket(null);
    setHistory([]);
    setClosed(false);
    setShowFeedback(false);

    try {
      const res = await fetch(`${TICKET_API}/get-ticket-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_number: ticketNumber.trim(),
          email: email.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || `Ticket not found or email does not match.`
        );
      }

      const data = await res.json();
      setTicket(data.ticket);
      setHistory(data.history || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch ticket status");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!ticket) return;
    setClosing(true);
    setError("");

    try {
      const res = await fetch(`${TICKET_API}/close-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_number: ticket.ticket_number,
          email: email.trim(),
          ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to close ticket");
      }

      setClosed(true);
      setTicket((prev) => (prev ? { ...prev, status: "closed" } : prev));
    } catch (err: any) {
      setError(err.message || "Failed to close ticket");
    } finally {
      setClosing(false);
    }
  };

  const currentStatusIndex = ticket
    ? STATUS_ORDER.indexOf(ticket.status)
    : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-white rounded-lg p-2 border">
            <img src={rmplLogo} alt="RMPL" className="h-8 w-auto" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Support Ticket Tracker
            </h1>
            <p className="text-xs text-gray-500">
              Track your support request status
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Search Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Look Up Your Ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={fetchStatus} className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Ticket number (e.g. TKT-00123)"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="flex-1"
              />
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !ticketNumber.trim() || !email.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Track
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Closed confirmation */}
        {closed && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-800">
                Ticket Closed Successfully
              </h3>
              <p className="text-sm text-green-600 mt-1">
                Thank you for confirming. Your ticket has been closed.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Ticket Details */}
        {ticket && (
          <>
            {/* Ticket Info */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground font-mono">
                      {ticket.ticket_number}
                    </p>
                    <CardTitle className="text-xl mt-1">
                      {ticket.subject}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ticket.priority && (
                      <Badge
                        className={
                          PRIORITY_COLORS[ticket.priority.toLowerCase()] ||
                          "bg-gray-100 text-gray-700"
                        }
                        variant="secondary"
                      >
                        {ticket.priority}
                      </Badge>
                    )}
                    <Badge
                      className={`${STATUS_CONFIG[ticket.status]?.color || "bg-gray-500"} text-white`}
                    >
                      {STATUS_CONFIG[ticket.status]?.label || ticket.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                      Description
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  {ticket.category && (
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="font-medium">{ticket.category}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(ticket.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {ticket.assigned_to && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Assigned To
                      </p>
                      <p className="font-medium">{ticket.assigned_to}</p>
                    </div>
                  )}
                  {ticket.updated_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Last Updated
                      </p>
                      <p className="font-medium">
                        {new Date(ticket.updated_at).toLocaleDateString(
                          "en-IN",
                          { day: "2-digit", month: "short", year: "numeric" }
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between overflow-x-auto pb-2">
                  {STATUS_ORDER.map((status, idx) => {
                    const config = STATUS_CONFIG[status];
                    const Icon = config.icon;
                    const isCompleted = idx <= currentStatusIndex;
                    const isCurrent = idx === currentStatusIndex;

                    return (
                      <div key={status} className="flex items-center">
                        <div className="flex flex-col items-center min-w-[70px]">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isCurrent
                                ? `${config.color} text-white ring-4 ring-opacity-30 ring-current`
                                : isCompleted
                                  ? `${config.color} text-white`
                                  : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span
                            className={`text-[10px] mt-1.5 text-center leading-tight ${
                              isCurrent
                                ? "font-bold text-gray-900"
                                : isCompleted
                                  ? "font-medium text-gray-700"
                                  : "text-gray-400"
                            }`}
                          >
                            {config.label}
                          </span>
                        </div>
                        {idx < STATUS_ORDER.length - 1 && (
                          <div
                            className={`h-0.5 w-6 sm:w-10 mx-1 ${
                              idx < currentStatusIndex
                                ? "bg-green-400"
                                : "bg-gray-200"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {history.map((entry, idx) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          {idx < history.length - 1 && (
                            <div className="w-px flex-1 bg-gray-200 my-1" />
                          )}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {entry.action}
                            {entry.new_value && (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                <ArrowRight className="inline h-3 w-3" />{" "}
                                {entry.new_value}
                              </span>
                            )}
                          </p>
                          {entry.comment && (
                            <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">
                              {entry.comment}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(entry.created_at).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {entry.changed_by && ` · ${entry.changed_by}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirm & Close (only when resolved and not already closed) */}
            {ticket.status === "resolved" && !closed && (
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-green-800">
                    <ThumbsUp className="h-4 w-4" />
                    Your issue has been resolved
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-green-700">
                    If you're satisfied with the resolution, please confirm to
                    close this ticket. You can also leave optional feedback.
                  </p>

                  {showFeedback ? (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Share your feedback (optional)..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleClose}
                          disabled={closing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {closing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Confirm & Close Ticket
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowFeedback(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setShowFeedback(true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirm & Close Ticket
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          Powered by Redefine Marcom
        </div>
      </footer>
    </div>
  );
}
