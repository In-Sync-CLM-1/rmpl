import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isTomorrow, isPast, differenceInDays } from "date-fns";
import { Phone, Calendar, ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ScheduledCall {
  id: string;
  type: "call";
  title: string;
  company_name: string | null;
  contact_name: string | null;
  scheduled_date: string;
  phone: string | null;
}

interface ScheduledEvent {
  id: string;
  type: "event";
  title: string;
  description: string | null;
  scheduled_date: string;
  location: string | null;
  event_type: string | null;
}

type ScheduledItem = ScheduledCall | ScheduledEvent;

export function UpcomingActivities() {
  const { data: items, isLoading } = useQuery({
    queryKey: ["upcoming-activities"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch scheduled calls (demandcom with next_call_date)
      const { data: calls, error: callsError } = await supabase
        .from("demandcom")
        .select("id, company_name, name, next_call_date, mobile_numb")
        .eq("assigned_to", user.id)
        .gte("next_call_date", today.toISOString())
        .order("next_call_date", { ascending: true })
        .limit(5);

      if (callsError) console.error("Error fetching calls:", callsError);

      // Fetch upcoming events
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, description, start_time, location, event_type")
        .gte("start_time", today.toISOString())
        .order("start_time", { ascending: true })
        .limit(5);

      if (eventsError) console.error("Error fetching events:", eventsError);

      // Format calls
      const formattedCalls: ScheduledCall[] = (calls || []).map((c) => ({
        id: c.id,
        type: "call" as const,
        title: "Scheduled Call",
        company_name: c.company_name,
        contact_name: c.name,
        scheduled_date: c.next_call_date,
        phone: c.mobile_numb,
      }));

      // Format events
      const formattedEvents: ScheduledEvent[] = (events || []).map((e) => ({
        id: e.id,
        type: "event" as const,
        title: e.title,
        description: e.description,
        scheduled_date: e.start_time,
        location: e.location,
        event_type: e.event_type,
      }));

      // Merge and sort by date
      return [...formattedCalls, ...formattedEvents].sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      ).slice(0, 5);
    },
  });

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM dd");
  };

  const getDateBadgeStyle = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isPast(date) && !isToday(date)) return "bg-gradient-to-r from-red-500 to-rose-500 text-white";
    if (isToday(date)) return "bg-gradient-to-r from-green-500 to-emerald-500 text-white";
    if (isTomorrow(date)) return "bg-gradient-to-r from-yellow-400 to-amber-400 text-yellow-900";
    return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white";
  };

  const isDueSoon = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diff = differenceInDays(date, today);
    return diff >= 0 && diff <= 2;
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Upcoming Activities
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Upcoming Activities
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            {items?.length || 0} scheduled calls & events
          </CardDescription>
        </div>
        <Link to="/calendar">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
            Calendar <ChevronRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-3 pb-3">
        {!items || items.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Calendar className="h-8 w-8 mx-auto mb-1 opacity-50" />
            <p>No upcoming activities</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const dueSoon = isDueSoon(item.scheduled_date);
              return (
              <div 
                key={`${item.type}-${item.id}`} 
                className={`flex items-center justify-between p-2 rounded-lg transition-colors border-l-3 ${
                  dueSoon 
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-l-amber-500 ring-1 ring-amber-200 dark:ring-amber-800' 
                    : 'bg-muted/30 hover:bg-muted/50 border-l-indigo-400'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.type === "call" ? (
                    <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
                      <Phone className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                      <Calendar className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.type === "call" 
                        ? (item as ScheduledCall).contact_name || "Unknown" 
                        : item.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.type === "call" 
                        ? (item as ScheduledCall).company_name 
                        : (item as ScheduledEvent).location && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {(item as ScheduledEvent).location}
                            </span>
                          )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <Badge className={`text-[10px] px-2 py-0 h-5 ${getDateBadgeStyle(item.scheduled_date)}`}>
                    {getDateLabel(item.scheduled_date)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(item.scheduled_date), "h:mm a")}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}