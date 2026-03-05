import { useState, useMemo } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, setHours } from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, ArrowLeft, CalendarPlus, Activity, PartyPopper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEvents, Event } from "@/hooks/useEvents";
import { EventDialog } from "@/components/EventDialog";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyHolidays, CompanyHoliday } from "@/hooks/useCompanyHolidays";
import { parseLocalDateString } from "@/lib/dateUtils";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Colorful event type color mapping
const eventTypeColors: Record<string, string> = {
  call: "#8b5cf6",      // violet
  task: "#f97316",      // orange
  meeting: "#06b6d4",   // cyan
  follow_up: "#ec4899", // pink
  reminder: "#eab308",  // yellow
  general: "#3b82f6",   // blue
  project: "#10b981",   // emerald - for projects
  holiday: "#f59e0b",   // amber - for holidays applicable to user (festive gold)
  holiday_other: "#94a3b8", // gray - for holidays not applicable to user
};

interface ProjectEventDate {
  date: string;
  type: string;
}

interface Project {
  id: string;
  project_name: string;
  project_number: string | null;
  event_dates: ProjectEventDate[] | null;
  status: string;
}

export default function Calendar() {
  const navigate = useNavigate();
  const { events, isLoading, createEvent, updateEvent, deleteEvent } = useEvents();
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [defaultEventType, setDefaultEventType] = useState<string>("general");

  const currentYear = date.getFullYear();
  const { holidays, applicableHolidays, userLocation } = useCompanyHolidays(currentYear);

  // Fetch projects with event dates
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, project_number, event_dates, status")
        .not("event_dates", "is", null);
      
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        event_dates: p.event_dates as unknown as ProjectEventDate[] | null,
      })) as Project[];
    },
  });

  const calendarEvents = useMemo(() => {
    // Regular events
    const regularEvents = events.map((event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      resource: event,
      isProject: false,
      isHoliday: false,
    }));

    // Project events from event_dates
    const projectEvents = projects.flatMap((project) => {
      if (!project.event_dates || !Array.isArray(project.event_dates)) return [];
      
      return project.event_dates.map((eventDate, index) => {
        const dateObj = parseLocalDateString(eventDate.date);
        let start: Date, end: Date;

        // Set time based on event type
        if (eventDate.type === "first_half") {
          start = setHours(startOfDay(dateObj), 9);
          end = setHours(startOfDay(dateObj), 13);
        } else if (eventDate.type === "second_half") {
          start = setHours(startOfDay(dateObj), 14);
          end = setHours(startOfDay(dateObj), 18);
        } else {
          // full_day or default
          start = startOfDay(dateObj);
          end = endOfDay(dateObj);
        }

        return {
          id: `${project.id}-${index}`,
          title: `📁 ${project.project_name}`,
          start,
          end,
          resource: {
            id: project.id,
            title: project.project_name,
            event_type: "project",
            color: eventTypeColors.project,
            description: `Project: ${project.project_name}\nStatus: ${project.status}`,
            projectId: project.id,
          },
          isProject: true,
          isHoliday: false,
        };
      });
    });

    // Holiday events
    const holidayEvents = holidays.map((holiday) => {
      const dateObj = parseLocalDateString(holiday.holiday_date);
      const isApplicable = !holiday.applicable_locations || 
        holiday.applicable_locations.includes("all") ||
        holiday.applicable_locations.includes(userLocation || "Delhi");

      return {
        id: `holiday-${holiday.id}`,
        title: `🎉 ${holiday.holiday_name}`,
        start: startOfDay(dateObj),
        end: endOfDay(dateObj),
        allDay: true,
        resource: {
          id: holiday.id,
          title: holiday.holiday_name,
          event_type: isApplicable ? "holiday" : "holiday_other",
          color: isApplicable ? eventTypeColors.holiday : eventTypeColors.holiday_other,
          description: `${holiday.holiday_name}${holiday.notes ? ` - ${holiday.notes}` : ""}\nLocations: ${holiday.applicable_locations?.join(", ") || "All"}`,
          isHoliday: true,
          isApplicable,
          holidayData: holiday,
        },
        isProject: false,
        isHoliday: true,
        isApplicable,
      };
    });

    return [...holidayEvents, ...regularEvents, ...projectEvents];
  }, [events, projects, holidays, userLocation]);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedEvent(null);
    setSelectedSlot({ start, end });
    setDefaultEventType("general");
    setDialogOpen(true);
  };

  const handleSelectEvent = (event: any) => {
    // If it's a holiday, just show info (don't open dialog)
    if (event.isHoliday) {
      return;
    }
    // If it's a project event, navigate to the project
    if (event.isProject && event.resource.projectId) {
      navigate(`/projects/view/${event.resource.projectId}`);
      return;
    }
    setSelectedEvent(event.resource);
    setSelectedSlot(null);
    setDialogOpen(true);
  };

  const handleNewEvent = () => {
    setSelectedEvent(null);
    setSelectedSlot(null);
    setDefaultEventType("general");
    setDialogOpen(true);
  };

  const handleNewActivity = () => {
    setSelectedEvent(null);
    setSelectedSlot(null);
    setDefaultEventType("task");
    setDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    if (selectedEvent) {
      await updateEvent({ id: selectedEvent.id, ...data });
    } else {
      await createEvent(data);
    }
  };

  const handleDelete = async () => {
    if (selectedEvent && confirm("Are you sure you want to delete this event?")) {
      await deleteEvent(selectedEvent.id);
      setDialogOpen(false);
      setSelectedEvent(null);
    }
  };

  const eventStyleGetter = (event: any) => {
    const eventType = event.resource?.event_type || "general";
    const bgColor = event.resource?.color || eventTypeColors[eventType] || eventTypeColors.general;
    
    // Special styling for holidays (amber/gold for festive look)
    if (event.isHoliday) {
      return {
        style: {
          backgroundColor: bgColor,
          borderRadius: "6px",
          opacity: event.isApplicable ? 0.95 : 0.6,
          color: "white",
          border: event.isApplicable ? "2px solid #d97706" : "1px dashed #94a3b8",
          display: "block",
          fontWeight: 600,
          boxShadow: event.isApplicable ? "0 2px 8px rgba(245, 158, 11, 0.3)" : "none",
        }
      };
    }
    
    return {
      style: {
        backgroundColor: bgColor,
        borderRadius: "6px",
        opacity: 0.95,
        color: "white",
        border: "none",
        display: "block",
        fontWeight: 500,
        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
      }
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-semibold mb-1">Calendar</h2>
            <p className="text-sm text-muted-foreground">Manage and track all your events & activities</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleNewEvent}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            New Event
          </Button>
          <Button 
            onClick={handleNewActivity}
            className="bg-violet-500 hover:bg-violet-600 text-white"
          >
            <Activity className="h-4 w-4 mr-2" />
            New Activity
          </Button>
        </div>
      </div>

      {/* Event type legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(eventTypeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color }}
            />
            <span className="capitalize text-muted-foreground">
              {type === "holiday" ? "Holiday (Your Location)" : 
               type === "holiday_other" ? "Holiday (Other)" : 
               type.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      <Card className="p-6 overflow-hidden">
        <style>{`
          .rbc-calendar {
            font-family: inherit;
          }
          .rbc-header {
            background-color: #8b5cf6;
            color: white;
            padding: 12px 8px;
            font-weight: 600;
            border: none !important;
          }
          .rbc-month-view {
            border: 1px solid hsl(var(--border));
            border-radius: 8px;
            overflow: hidden;
          }
          .rbc-day-bg:hover {
            background-color: hsl(var(--accent) / 0.5);
          }
          .rbc-today {
            background-color: #fef3c7 !important;
          }
          .rbc-off-range-bg {
            background-color: hsl(var(--muted) / 0.3);
          }
          .rbc-toolbar button {
            border-radius: 6px;
            border: 1px solid hsl(var(--border));
            padding: 8px 16px;
            font-weight: 500;
          }
          .rbc-toolbar button:hover {
            background-color: #8b5cf6;
            color: white;
            border-color: #8b5cf6;
          }
          .rbc-toolbar button.rbc-active {
            background-color: #8b5cf6;
            color: white;
            border-color: #8b5cf6;
          }
          .rbc-event {
            padding: 4px 8px;
            font-size: 12px;
          }
          .rbc-selected {
            background-color: #7c3aed !important;
          }
          .rbc-show-more {
            color: #8b5cf6;
            font-weight: 600;
          }
          .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
            background-color: #8b5cf6;
            color: white;
            padding: 12px;
          }
          .rbc-current-time-indicator {
            background-color: #ec4899;
            height: 2px;
          }
        `}</style>
        <div style={{ height: "700px" }}>
          <BigCalendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            eventPropGetter={eventStyleGetter}
            popup
            views={["month", "week", "day", "agenda"]}
          />
        </div>
      </Card>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        event={selectedEvent}
        defaultStart={selectedSlot?.start}
        defaultEnd={selectedSlot?.end}
        defaultEventType={defaultEventType}
      />

      {selectedEvent && dialogOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSelectedEvent(selectedEvent); setDialogOpen(true); }}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
