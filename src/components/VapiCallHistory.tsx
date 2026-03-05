import { useState } from "react";
import { Phone, Clock, FileText, ChevronDown, ChevronUp, Brain, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVapiCallLogs } from "@/hooks/useVapiCalls";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  "in-progress": "bg-blue-100 text-blue-800",
  ringing: "bg-purple-100 text-purple-800",
  ended: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const sentimentColors: Record<string, string> = {
  positive: "bg-green-100 text-green-800 border-green-300",
  neutral: "bg-yellow-100 text-yellow-800 border-yellow-300",
  negative: "bg-red-100 text-red-800 border-red-300",
};

interface VapiCallHistoryProps {
  demandcomId?: string;
  limit?: number;
}

export function VapiCallHistory({ demandcomId, limit }: VapiCallHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs, isLoading } = useVapiCallLogs({
    status: statusFilter || undefined,
    demandcom_id: demandcomId,
    limit,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading call history...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" />
          VAPI Call History
        </CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!logs?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No call logs found
          </p>
        ) : (
          <div className="space-y-2">
            {logs.map((log: any) => (
              <div
                key={log.id}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {log.contact_name || log.phone_number}
                    </span>
                    {log.contact_name && (
                      <span className="text-xs text-muted-foreground">
                        {log.phone_number}
                      </span>
                    )}
                    {log.sentiment && (
                      <Badge variant="outline" className={sentimentColors[log.sentiment] || ""}>
                        {log.sentiment}
                        {log.sentiment_score != null && (
                          <span className="ml-1 opacity-70">
                            ({Math.round(log.sentiment_score * 100)}%)
                          </span>
                        )}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[log.status] || "bg-gray-100 text-gray-800"}>
                      {log.status}
                    </Badge>
                    {(log.transcript || log.call_summary || log.response_summary) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          setExpandedId(expandedId === log.id ? null : log.id)
                        }
                      >
                        {expandedId === log.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(log.created_at), "dd MMM yyyy, hh:mm a")}
                  </span>
                  {log.duration_seconds != null && (
                    <span>Duration: {log.duration_seconds}s</span>
                  )}
                </div>

                {expandedId === log.id && (
                  <div className="mt-2 space-y-3 text-sm">
                    {/* AI Response Summary */}
                    {log.response_summary && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center gap-1">
                          <Brain className="h-3 w-3" /> AI Response Summary
                        </p>
                        <p className="text-muted-foreground bg-muted p-2 rounded text-xs">
                          {log.response_summary}
                        </p>
                      </div>
                    )}

                    {/* Key Topics */}
                    {log.key_topics && log.key_topics.length > 0 && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center gap-1">
                          <Tag className="h-3 w-3" /> Key Topics
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {log.key_topics.map((topic: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Call Summary (from Vapi) */}
                    {log.call_summary && (
                      <div>
                        <p className="font-medium text-xs mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Call Summary
                        </p>
                        <p className="text-muted-foreground bg-muted p-2 rounded text-xs">
                          {log.call_summary}
                        </p>
                      </div>
                    )}

                    {/* Transcript */}
                    {log.transcript && (
                      <div>
                        <p className="font-medium text-xs mb-1">Transcript</p>
                        <pre className="text-muted-foreground bg-muted p-2 rounded text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {log.transcript}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
