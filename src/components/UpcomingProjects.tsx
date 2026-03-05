import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  project_number: string | null;
  project_name: string;
  event_dates: any;
  status: string;
  project_value: number | null;
}

export function UpcomingProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingProjects();
  }, []);

  const fetchUpcomingProjects = async () => {
    try {
      const today = new Date();
      const futureDate = addDays(today, 15);

      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, event_dates, status, project_value")
        .in("status", ["pipeline", "active", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filter projects with event dates in the next 15 days
      const filtered = (data || [])
        .filter((project) => {
          if (!project.event_dates) return false;
          
          const dates = Array.isArray(project.event_dates) 
            ? project.event_dates 
            : [project.event_dates];
          
          return dates.some((dateStr: string) => {
            try {
              const eventDate = parseISO(dateStr);
              return eventDate >= today && eventDate <= futureDate;
            } catch {
              return false;
            }
          });
        })
        .slice(0, 10);

      setProjects(filtered);
    } catch (error) {
      console.error("Error fetching upcoming projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNextEventDate = (eventDates: any) => {
    if (!eventDates) return null;
    
    const dates = Array.isArray(eventDates) ? eventDates : [eventDates];
    const today = new Date();
    
    const upcomingDates = dates
      .map((d: string) => {
        try {
          return parseISO(d);
        } catch {
          return null;
        }
      })
      .filter((d): d is Date => d !== null && d >= today)
      .sort((a, b) => a.getTime() - b.getTime());
    
    return upcomingDates[0] || null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "default";
      case "active": return "secondary";
      case "pipeline": return "outline";
      default: return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Projects</CardTitle>
          <CardDescription>Next 15 days</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upcoming Projects</CardTitle>
        <CardDescription>Next 15 days • {projects.length} project{projects.length !== 1 ? "s" : ""}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming projects</p>
        ) : (
          projects.map((project) => {
            const nextDate = getNextEventDate(project.event_dates);
            return (
              <div
                key={project.id}
                className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {project.project_number && (
                        <span className="text-sm font-mono font-semibold text-primary hover:underline">
                          {project.project_number}
                        </span>
                      )}
                      <Badge variant={getStatusColor(project.status)} className="text-[10px] px-1.5 py-0">
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{project.project_name}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </div>
                
                {nextDate && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{format(nextDate, "MMM dd, yyyy")}</span>
                  </div>
                )}
                
                {project.project_value && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Value: ₹{(project.project_value / 100000).toFixed(2)}L
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
