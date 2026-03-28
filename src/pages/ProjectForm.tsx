import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logError, getSupabaseErrorMessage, getCurrentUserId } from "@/lib/errorLogger";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProjectFileUploader } from "@/components/ProjectFileUploader";
import { ProjectTeamSelector } from "@/components/ProjectTeamSelector";
import { ProjectTaskManager } from "@/components/ProjectTaskManager";
import { ProjectLiveComEvents } from "@/components/ProjectLiveComEvents";
import { ProjectDemandComAllocations } from "@/components/ProjectDemandComAllocations";
import { ProjectInvoiceManager } from "@/components/cashflow/ProjectInvoiceManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProjectFormData = {
  project_number: string;
  project_name: string;
  brief: string;
  client_id: string;
  contact_id: string;
  project_owner: string;
  status: string;
  project_source: string;
  referrer_name: string;
  project_value: string;
  management_fees: string;
  expected_afactor: string;
  final_afactor: string;
  closed_reason: string;
  lost_reason: string;
  number_of_attendees: string;
};

type Location = {
  city: string;
  venue: string;
};

type EventDate = {
  date: string;
  type: 'full_day' | 'first_half' | 'second_half';
};

const projectFormSchema = z.object({
  project_number: z.string().optional(), // Auto-generated for new projects
  project_name: z.string().min(1, "Project name is required"),
  project_owner: z.string().min(1, "Project owner is required"),
  status: z.string().min(1, "Status is required"),
  brief: z.string().optional(),
  client_id: z.string().optional(),
  contact_id: z.string().optional(),
  project_source: z.string().optional(),
  referrer_name: z.string().optional(),
  project_value: z.string().optional(),
  management_fees: z.string().optional(),
  expected_afactor: z.string().optional(),
  final_afactor: z.string().optional(),
  closed_reason: z.string().optional(),
  lost_reason: z.string().optional(),
  number_of_attendees: z.string().min(1, "Number of attendees is required"),
});

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id && id !== 'new';
  const wasCreatingRef = useRef(!isEditing); // Capture at mount time
  const hasNavigatedRef = useRef(false); // Prevent double navigation
  
  // Reset navigation guard when ID changes (allows multiple saves)
  useEffect(() => {
    hasNavigatedRef.current = false;
  }, [id]);
  
  const [teamMembers, setTeamMembers] = useState<Array<{ user_id: string; role_in_project: string }>>([]);
  const [filesChanged, setFilesChanged] = useState(false);
  const [locations, setLocations] = useState<Location[]>([{ city: "", venue: "" }]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      project_number: "",
      project_name: "",
      brief: "",
      client_id: "",
      contact_id: "",
      project_owner: "",
      status: "pitched",
      project_source: "",
      referrer_name: "",
      project_value: "",
      management_fees: "",
      expected_afactor: "",
      final_afactor: "",
      closed_reason: "",
      lost_reason: "",
      number_of_attendees: "",
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, assigned_to")
        .order("company_name");
      if (error) {
        logError(error, {
          component: "ProjectForm",
          operation: "FETCH_DATA",
          userId: await getCurrentUserId(supabase),
          metadata: { fetchType: "clients" },
        });
        throw error;
      }
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["client-contacts", selectedCompany],
    queryFn: async () => {
      if (!selectedCompany) return [];
      // Find the client UUID for the selected company name
      const client = clients?.find(c => c.company_name === selectedCompany);
      if (!client) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, contact_name, contact_number, email_id")
        .eq("client_id", client.id)
        .order("contact_name");
      if (error) {
        logError(error, {
          component: "ProjectForm",
          operation: "FETCH_DATA",
          userId: await getCurrentUserId(supabase),
          metadata: { fetchType: "contacts" },
        });
        throw error;
      }
      return data;
    },
    enabled: !!selectedCompany && !!clients,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) {
        logError(error, {
          component: "ProjectForm",
          operation: "FETCH_DATA",
          userId: await getCurrentUserId(supabase),
          metadata: { fetchType: "profiles" },
        });
        throw error;
      }
      return data;
    },
  });

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          project_team_members (
            user_id,
            role_in_project
          )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (project && clients) {
      form.reset({
        project_number: project.project_number || "",
        project_name: project.project_name,
        brief: project.brief || "",
        client_id: project.client_id || "",
        contact_id: project.contact_id || "",
        project_owner: project.project_owner || "",
        status: project.status,
        project_source: project.project_source || "",
        referrer_name: (project as any).referrer_name || "",
        project_value: project.project_value?.toString() || "",
        management_fees: project.management_fees?.toString() || "",
        expected_afactor: project.expected_afactor?.toString() || "",
        final_afactor: project.final_afactor?.toString() || "",
        closed_reason: project.closed_reason || "",
        lost_reason: project.lost_reason || "",
        number_of_attendees: (project as any).number_of_attendees?.toString() || "",
      });
      
      // Set selected company from client_id if it exists
      if (project.client_id) {
        setSelectedCompany(project.client_id);
      }
      
      // Parse locations from JSONB
      const projectLocations = Array.isArray(project.locations) 
        ? project.locations as Location[]
        : [];
      setLocations(projectLocations.length > 0 ? projectLocations : [{ city: "", venue: "" }]);
      
      // Parse event dates
      const dates = Array.isArray(project.event_dates)
        ? (project.event_dates as EventDate[])
        : [];
      setEventDates(dates);
      
      if (project.project_team_members) {
        setTeamMembers(project.project_team_members.map((m: any) => ({
          user_id: m.user_id,
          role_in_project: m.role_in_project
        })));
      }
    }
  }, [project, clients, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Auto-generate project number for new projects
      let projectNumber = data.project_number;
      if (!isEditing) {
        const { data: generatedNumber, error: rpcError } = await supabase.rpc('generate_project_number');
        if (rpcError) throw rpcError;
        projectNumber = generatedNumber;
      }

      const projectData: any = {
        project_number: projectNumber,
        project_name: data.project_name,
        brief: data.brief || null,
        client_id: data.client_id || (isEditing ? project?.client_id : null) || null,
        contact_id: data.contact_id || (isEditing ? project?.contact_id : null) || null,
        project_owner: data.project_owner,
        locations: JSON.parse(JSON.stringify(locations.filter(l => l.city || l.venue))),
        event_dates: JSON.parse(JSON.stringify(eventDates.filter(d => d.date))),
        status: data.status,
        project_source: data.project_source || null,
        referrer_name: data.project_source === 'reference' ? (data.referrer_name || null) : null,
        project_value: data.project_value ? parseFloat(data.project_value) : null,
        management_fees: data.management_fees ? parseFloat(data.management_fees) : null,
        expected_afactor: data.expected_afactor ? parseFloat(data.expected_afactor) : null,
        final_afactor: data.final_afactor ? parseFloat(data.final_afactor) : null,
        closed_reason: data.status === 'closed' ? data.closed_reason : null,
        lost_reason: data.status === 'lost' ? data.lost_reason : null,
        number_of_attendees: data.number_of_attendees !== "" ? parseInt(data.number_of_attendees, 10) : null,
        created_by: user.id,
      };

      let projectId = id;

      if (isEditing) {
        const { error } = await supabase
          .from("projects")
          .update(projectData)
          .eq("id", id);
        if (error) throw error;

        // Delete existing team members and re-insert
        await supabase.from("project_team_members").delete().eq("project_id", id);
      } else {
        const { data: newProject, error } = await supabase
          .from("projects")
          .insert(projectData)
          .select()
          .single();
        if (error) throw error;
        projectId = newProject.id;
      }

      // Insert team members
      if (teamMembers.length > 0 && projectId) {
        const teamData = teamMembers.map(member => ({
          project_id: projectId,
          user_id: member.user_id,
          role_in_project: member.role_in_project,
          assigned_by: user.id,
        }));
        const { error: teamError } = await supabase
          .from("project_team_members")
          .insert(teamData);
        if (teamError) throw teamError;
      }

      return projectId;
    },
    onSuccess: async (projectId) => {
      // GUARD: Prevent double execution
      if (hasNavigatedRef.current) {
        console.log("✅ Navigation guard: Already processed, skipping");
        return;
      }
      
      const wasCreating = wasCreatingRef.current;
      console.log("📝 Project saved:", { projectId, wasCreating });
      
      // STEP 1: Always navigate to project form (for both create and edit)
      if (projectId) {
        console.log("🚀 Navigating to project form:", `/projects/edit/${projectId}`);
        navigate(`/projects/edit/${projectId}`, { replace: true });
        hasNavigatedRef.current = true;
      }
      
      // STEP 2: Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["csbd-metrics"] });
      await queryClient.invalidateQueries({ queryKey: ["all-csbd-metrics"] });
      console.log("🔄 Queries invalidated");
      
      // STEP 3: Show ONE clear toast message
      if (wasCreating) {
        toast({
          title: "✅ Project Created",
          description: "You can now add tasks, files, and quotations to your project",
        });
      } else {
        toast({
          title: "✅ Project Updated",
          description: "Your changes have been saved successfully",
        });
      }
      
      // STEP 4: Send emails in background (non-blocking)
      if (teamMembers.length > 0 && projectId) {
        supabase.functions.invoke("send-project-email", {
          body: { project_id: projectId },
        })
        .then(({ data, error }) => {
          if (error) {
            console.error("❌ Email notification error:", error);
          } else if (data?.sent > 0) {
            console.log(`📧 Email sent to ${data.sent} team member(s)`);
          }
        })
        .catch((err) => {
          console.error("❌ Email sending failed:", err);
        });
      }
    },
    onError: async (error: Error) => {
      logError(error, {
        component: "ProjectForm",
        operation: isEditing ? "UPDATE_DATA" : "CREATE_DATA",
        userId: await getCurrentUserId(supabase),
        metadata: { projectId: id },
      });
      toast({
        title: `Error ${isEditing ? "updating" : "creating"} project`,
        description: getSupabaseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  // Query to check task count for existing projects
  const { data: taskCount = 0 } = useQuery({
    queryKey: ["project-task-count", id],
    queryFn: async () => {
      if (!id || id === 'new') return 0;
      const { count, error } = await supabase
        .from("project_tasks")
        .select("*", { count: "exact", head: true })
        .eq("project_id", id);
      if (error) throw error;
      return count || 0;
    },
    enabled: isEditing,
  });

  const onSubmit = (data: ProjectFormData) => {
    // Validate event dates - at least one required
    if (eventDates.filter(d => d.date).length === 0) {
      toast({
        title: "Event Date Required",
        description: "Please add at least one event date",
        variant: "destructive",
      });
      return;
    }
    
    // Validate team members - at least one required
    if (teamMembers.length === 0) {
      toast({
        title: "Team Members Required",
        description: "Please assign at least one team member to the project",
        variant: "destructive",
      });
      return;
    }
    
    // For existing projects: validate tasks when moving beyond "pitched"
    const statusRequiresTasks = ["confirmed", "in_progress", "completed", "closed"];
    if (isEditing && statusRequiresTasks.includes(data.status) && taskCount === 0) {
      toast({
        title: "Tasks Required",
        description: `Please add at least one task before changing status to "${data.status}"`,
        variant: "destructive",
      });
      return;
    }
    
    saveMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold">
              {isEditing ? "Edit Project" : "New Project"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEditing ? "Update project details" : "Create a new project posting"}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="tasks" className="relative">
                  Tasks
                  {isEditing && taskCount === 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
                <TabsTrigger value="livecom">LiveCom</TabsTrigger>
                <TabsTrigger value="demandcom">DemandCom</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="bg-card rounded-lg border p-6 space-y-4">
                  {isEditing && project?.project_number && (
                    <div className="flex flex-col gap-2">
                      <FormLabel>Project Number</FormLabel>
                      <div className="bg-muted px-4 py-3 rounded-md">
                        <span className="font-mono font-semibold text-primary text-lg">
                          {project.project_number}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Project number is auto-generated and cannot be changed</p>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="project_name"
                    rules={{ required: "Project name is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Product Launch 2024" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brief"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Brief</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the project scope, objectives, and requirements..."
                            rows={6}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedCompany(value);
                            form.setValue("contact_id", ""); // Reset contact when client changes
                            // Auto-set project owner from client's assigned_to
                            const selectedClient = clients?.find(c => c.company_name === value);
                            if (selectedClient?.assigned_to && !isEditing) {
                              form.setValue("project_owner", selectedClient.assigned_to);
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover z-50">
                            {clients?.map((client) => (
                              <SelectItem key={client.company_name} value={client.company_name}>
                                {client.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!selectedCompany}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder={selectedCompany ? "Select a contact" : "Select a client first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover z-50">
                            {contacts?.map((contact) => (
                              <SelectItem key={contact.id} value={contact.contact_name}>
                                {contact.contact_name}{contact.contact_number ? ` - ${contact.contact_number}` : ""}
                              </SelectItem>
                            ))}
                            {contacts?.length === 0 && selectedCompany && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">No contacts found</div>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_owner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Owner *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select project owner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover z-50">
                            {profiles?.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.full_name || profile.email}
                              </SelectItem>
                            ))}
                            {profiles?.length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">No users found</div>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <FormLabel>Event Locations</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLocations([...locations, { city: "", venue: "" }])}
                      >
                        Add Location
                      </Button>
                    </div>
                    {locations.map((location, index) => (
                      <div key={index} className="grid grid-cols-2 gap-4">
                        <div>
                          <Input
                            placeholder="City"
                            value={location.city}
                            onChange={(e) => {
                              const newLocations = [...locations];
                              newLocations[index].city = e.target.value;
                              setLocations(newLocations);
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Venue"
                            value={location.venue}
                            onChange={(e) => {
                              const newLocations = [...locations];
                              newLocations[index].venue = e.target.value;
                              setLocations(newLocations);
                            }}
                          />
                          {locations.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setLocations(locations.filter((_, i) => i !== index))}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <FormLabel>Event Dates *</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setEventDates([...eventDates, { date: today, type: 'full_day' }]);
                        }}
                      >
                        Add Date
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {eventDates.map((eventDate, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            type="date"
                            value={eventDate.date}
                            onChange={(e) => {
                              const newDates = [...eventDates];
                              newDates[index].date = e.target.value;
                              setEventDates(newDates);
                            }}
                            className="flex-1"
                          />
                          <Select
                            value={eventDate.type}
                            onValueChange={(value: 'full_day' | 'first_half' | 'second_half') => {
                              const newDates = [...eventDates];
                              newDates[index].type = value;
                              setEventDates(newDates);
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_day">Full Day</SelectItem>
                              <SelectItem value="first_half">1st Half</SelectItem>
                              <SelectItem value="second_half">2nd Half</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEventDates(eventDates.filter((_, i) => i !== index))}
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="project_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Source</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          // Clear referrer name if source is not reference
                          if (value !== 'reference') {
                            form.setValue('referrer_name', '');
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="inbound">Inbound</SelectItem>
                            <SelectItem value="outbound">Outbound</SelectItem>
                            <SelectItem value="reference">Reference</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("project_source") === "reference" && (
                    <FormField
                      control={form.control}
                      name="referrer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referrer Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter the name of the person who referred this project"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Project Commercials</h3>

                    <FormField
                      control={form.control}
                      name="number_of_attendees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Attendees *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              placeholder="Enter expected attendees"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="project_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Value</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="management_fees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Management Fees</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormItem>
                      <FormLabel>Grand Total</FormLabel>
                      <FormControl>
                        <Input 
                          type="text"
                          value={(() => {
                            const projectValue = parseFloat(form.watch("project_value")) || 0;
                            const managementFees = parseFloat(form.watch("management_fees")) || 0;
                            const total = projectValue + managementFees;
                            return total > 0 ? total.toFixed(2) : "0.00";
                          })()}
                          disabled
                          className="bg-muted"
                        />
                      </FormControl>
                    </FormItem>

                    <FormField
                      control={form.control}
                      name="expected_afactor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Afactor</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="final_afactor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Final Afactor</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pitched">Pitched / Brief Received</SelectItem>
                            <SelectItem value="in_discussion">In Discussion</SelectItem>
                            <SelectItem value="estimate_shared">Estimate Shared</SelectItem>
                            <SelectItem value="po_received">PO Received</SelectItem>
                            <SelectItem value="execution">Execution</SelectItem>
                            <SelectItem value="invoiced">Invoiced</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("status") === "closed" && (
                    <FormField
                      control={form.control}
                      name="closed_reason"
                      rules={{ required: "Reason is required when status is Closed" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Closed Reason *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Explain why the project was closed..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("status") === "lost" && (
                    <FormField
                      control={form.control}
                      name="lost_reason"
                      rules={{ required: "Reason is required when status is Lost" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lost Reason *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Explain why the project was lost..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="space-y-4 pt-6 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Project Team *</h3>
                      {teamMembers.length === 0 && (
                        <span className="text-sm text-destructive">At least one member required</span>
                      )}
                    </div>
                    <ProjectTeamSelector
                      value={teamMembers}
                      onChange={setTeamMembers}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <div className="bg-card rounded-lg border p-6">
                  {id && id !== 'new' ? (
                    <ProjectTaskManager projectId={id} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Save the project first to manage tasks
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="files" className="mt-4">
                <div className="bg-card rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Project Files</h3>
                  {isEditing && id ? (
                    <ProjectFileUploader
                      projectId={id}
                      onFileUploaded={() => setFilesChanged(!filesChanged)}
                    />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Save the project first to upload files
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="invoices" className="mt-4">
                <div className="bg-card rounded-lg border p-6">
                  {id && id !== 'new' ? (
                    <ProjectInvoiceManager projectId={id} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Save the project first to manage invoices
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="livecom" className="mt-4">
                <div className="bg-card rounded-lg border p-6">
                  {isEditing && id ? (
                    <ProjectLiveComEvents projectId={id} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Save the project first to manage LiveCom events
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="demandcom" className="mt-4">
                <div className="bg-card rounded-lg border p-6">
                  <ProjectDemandComAllocations 
                    projectId={isEditing ? id : undefined}
                    numberOfAttendees={parseInt(form.watch("number_of_attendees") || "0", 10)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/projects")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Project"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
