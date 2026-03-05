import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, PlayCircle, Search, FileText, Plus, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { CallDispositionDialog } from "./CallDispositionDialog";

interface CallHistoryProps {
  demandcomId?: string;
  limit?: number;
  showFilters?: boolean;
}

interface CallLog {
  id: string;
  call_sid: string;
  demandcom_id: string | null;
  initiated_by: string | null;
  from_number: string;
  to_number: string;
  status: string;
  conversation_duration: number;
  recording_url: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  disposition: string | null;
  subdisposition: string | null;
  notes: string | null;
  disposition_set_by: string | null;
  disposition_set_at: string | null;
  demandcom?: {
    name: string;
    mobile_numb: string;
  };
  initiated_by_profile?: {
    full_name: string;
    email: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'default';
    case 'no-answer':
    case 'busy':
      return 'secondary';
    case 'failed':
    case 'canceled':
      return 'destructive';
    case 'initiated':
    case 'ringing':
    case 'in-progress':
      return 'outline';
    default:
      return 'outline';
  }
};

const formatDuration = (seconds: number) => {
  if (seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function CallHistory({ demandcomId, limit = 50, showFilters = true }: CallHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);

  const { data: callLogs, isLoading, refetch } = useQuery({
    queryKey: ['call-logs', demandcomId, statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          demandcom:demandcom_id (
            name,
            mobile_numb
          ),
          initiated_by_profile:profiles!call_logs_initiated_by_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (demandcomId) {
        query = query.eq('demandcom_id', demandcomId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`to_number.ilike.%${searchQuery}%,from_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching call logs:', error);
        throw error;
      }

      return data as CallLog[];
    },
  });

  // Real-time subscription for call logs
  useEffect(() => {
    const channel = supabase
      .channel('call-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
          ...(demandcomId && { filter: `demandcom_id=eq.${demandcomId}` }),
        },
        () => {
          console.log('Call log updated, refetching...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demandcomId, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading call history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="no-answer">No Answer</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="initiated">Initiated</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!callLogs || callLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg">
          <Phone className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No call history yet</p>
          <p className="text-sm text-muted-foreground">Call logs will appear here once you make calls</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                {!demandcomId && <TableHead>Contact</TableHead>}
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Initiated By</TableHead>
                <TableHead>Recording</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {log.created_at && format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  {!demandcomId && (
                    <TableCell>
                      {log.demandcom?.name || '-'}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{log.to_number}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(log.status)}>
                      {log.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDuration(log.conversation_duration)}</TableCell>
                  <TableCell>
                    {log.disposition ? (
                      <div className="space-y-1">
                        <Badge variant="default">{log.disposition}</Badge>
                        {log.subdisposition && (
                          <div className="text-xs text-muted-foreground">{log.subdisposition}</div>
                        )}
                        {log.notes && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                <FileText className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Notes</h4>
                                <p className="text-sm text-muted-foreground">{log.notes}</p>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.initiated_by_profile?.full_name || log.initiated_by_profile?.email || '-'}
                  </TableCell>
                  <TableCell>
                    {log.recording_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(log.recording_url!, '_blank')}
                      >
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.disposition ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCallLog(log);
                          setDispositionDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCallLog(log);
                          setDispositionDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedCallLog && (
        <CallDispositionDialog
          open={dispositionDialogOpen}
          onOpenChange={setDispositionDialogOpen}
          callLogId={selectedCallLog.id}
          existingDisposition={{
            disposition: selectedCallLog.disposition,
            subdisposition: selectedCallLog.subdisposition,
            notes: selectedCallLog.notes,
          }}
        />
      )}
    </div>
  );
}
