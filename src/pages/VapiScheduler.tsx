import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Search, X, Clock, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default function VapiScheduler() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [firstMessage, setFirstMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch scheduled calls
  const { data: scheduledCalls, isLoading } = useQuery({
    queryKey: ["vapi-scheduled-calls", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("vapi_scheduled_calls" as any)
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(50);

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  // Search DemandCom contacts
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const filterPattern = `%${searchQuery}%`;
      const { data, error } = await supabase
        .from("demandcom" as any)
        .select("id, name, mobile_numb, company_name, activity_name")
        .or(`name.ilike.${filterPattern},mobile_numb.ilike.${filterPattern},company_name.ilike.${filterPattern}`)
        .limit(20);

      if (error) throw error;
      setSearchResults((data as any[]) || []);
    } catch (err) {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const addContact = (contact: any) => {
    if (!selectedContacts.find((c) => c.id === contact.id)) {
      setSelectedContacts((prev) => [...prev, contact]);
    }
  };

  const removeContact = (id: string) => {
    setSelectedContacts((prev) => prev.filter((c) => c.id !== id));
  };

  // Create scheduled call mutation
  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!scheduledDate || selectedContacts.length === 0) {
        throw new Error("Please select contacts and a date/time");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const scheduledAt = new Date(scheduledDate);
      scheduledAt.setHours(hours, minutes, 0, 0);

      const { error } = await supabase.from("vapi_scheduled_calls" as any).insert({
        demandcom_ids: selectedContacts.map((c) => c.id),
        scheduled_at: scheduledAt.toISOString(),
        first_message: firstMessage || null,
        notes: notes || null,
        total_contacts: selectedContacts.length,
        created_by: user.id,
        status: "pending",
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Call batch scheduled successfully");
      setSelectedContacts([]);
      setScheduledDate(undefined);
      setScheduledTime("10:00");
      setFirstMessage("");
      setNotes("");
      setSearchResults([]);
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ["vapi-scheduled-calls"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Cancel scheduled call
  const cancelSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vapi_scheduled_calls" as any)
        .update({ status: "cancelled" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scheduled call cancelled");
      queryClient.invalidateQueries({ queryKey: ["vapi-scheduled-calls"] });
    },
    onError: () => toast.error("Failed to cancel"),
  });

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <PageHeader title="VAPI Call Scheduler" />

      {/* Schedule New Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Schedule New Call Batch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact Search */}
          <div>
            <Label>Search & Add Contacts</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Search by name, mobile, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                <Search className="h-4 w-4 mr-1" />
                Search
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-lg mt-2 max-h-48 overflow-y-auto">
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    onClick={() => addContact(r)}
                  >
                    <div>
                      <span className="font-medium text-sm">{r.name || "N/A"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{r.mobile_numb}</span>
                      {r.company_name && (
                        <span className="text-xs text-muted-foreground ml-2">• {r.company_name}</span>
                      )}
                    </div>
                    <Button size="sm" variant="ghost">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Contacts */}
          {selectedContacts.length > 0 && (
            <div>
              <Label>Selected Contacts ({selectedContacts.length})</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedContacts.map((c) => (
                  <Badge key={c.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                    {c.name || c.mobile_numb}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeContact(c.id)} />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Schedule Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Schedule Time</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div>
            <Label>Custom First Message (optional)</Label>
            <Input
              placeholder="Override the default AI greeting..."
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Notes about this scheduled batch..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={() => createSchedule.mutate()}
            disabled={selectedContacts.length === 0 || !scheduledDate || createSchedule.isPending}
            className="w-full"
          >
            <CalendarClock className="h-4 w-4 mr-2" />
            Schedule {selectedContacts.length} Call{selectedContacts.length !== 1 ? "s" : ""}
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled Calls List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Call Batches
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : !scheduledCalls?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No scheduled calls yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled At</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledCalls.map((sc: any) => (
                  <TableRow key={sc.id}>
                    <TableCell className="text-sm">
                      {format(new Date(sc.scheduled_at), "dd MMM yyyy, hh:mm a")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {sc.total_contacts}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {sc.completed_count}/{sc.total_contacts}
                      {sc.failed_count > 0 && (
                        <span className="text-destructive ml-1">({sc.failed_count} failed)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[sc.status] || "bg-gray-100 text-gray-800"}>
                        {sc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {sc.notes || "-"}
                    </TableCell>
                    <TableCell>
                      {sc.status === "pending" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelSchedule.mutate(sc.id)}
                          disabled={cancelSchedule.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
