import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { z } from "zod";
import {
  ArrowLeft,
  CalendarIcon,
  MessageSquare,
  Pencil,
  Phone,
  Mail,
  Building2,
  MapPin,
  Linkedin,
  Globe,
  User,
  Briefcase,
  Clock,
  ExternalLink,
  X,
  Save,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Bot,
  FileText,
  Tag,
  ArrowRightLeft,
  Brain,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  CheckCheck,
  XCircle,
  MessageCircle,
} from "lucide-react";
import rmplLogo from "@/assets/rmpl-logo.png";
import { SendWhatsAppDialog } from "@/components/whatsapp/SendWhatsAppDialog";
import { CallAnalysisDialog } from "@/components/CallAnalysisDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Validation ───

const demandComSchema = z.object({
  salutation: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobile_numb: z.string().min(10, "Mobile number must be at least 10 digits"),
  mobile2: z.string().optional(),
  official: z.string().optional(),
  personal_email_id: z.string().email("Invalid email").optional().or(z.literal("")),
  generic_email_id: z.string().email("Invalid email").optional().or(z.literal("")),
  linkedin: z.string().url("Invalid URL").optional().or(z.literal("")),
  company_linkedin_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  associated_member_linkedin: z.string().url("Invalid URL").optional().or(z.literal("")),
  turnover_link: z.string().url("Invalid URL").optional().or(z.literal("")),
  designation: z.string().optional(),
  deppt: z.string().optional(),
  job_level_updated: z.string().optional(),
  country: z.string().optional(),
  company_name: z.string().optional(),
  industry_type: z.string().optional(),
  sub_industry: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  emp_size: z.string().optional(),
  turnover: z.string().optional(),
  erp_name: z.string().optional(),
  erp_vendor: z.string().optional(),
  head_office_location: z.string().optional(),
  source: z.string().optional(),
  source_1: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zone: z.string().optional(),
  tier: z.string().optional(),
  pincode: z.string().optional(),
  activity_name: z.string().optional(),
  latest_disposition: z.string().optional(),
  latest_subdisposition: z.string().optional(),
  last_call_date: z.string().optional(),
  next_call_date: z.string().optional(),
  extra: z.string().optional(),
  extra_1: z.string().optional(),
  extra_2: z.string().optional(),
  remarks: z.string().optional(),
});

type DemandComFormData = z.infer<typeof demandComSchema>;

// ─── Constants ───

const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];
const COUNTRIES = [
  "India", "USA", "UK", "Canada", "Australia", "Singapore", "UAE", "Germany", "France", "Japan"
];

const emptyForm: DemandComFormData = {
  salutation: "", name: "", mobile_numb: "", mobile2: "", official: "",
  personal_email_id: "", generic_email_id: "", linkedin: "",
  company_linkedin_url: "", associated_member_linkedin: "", turnover_link: "",
  designation: "", deppt: "", job_level_updated: "", country: "",
  company_name: "", industry_type: "", sub_industry: "", website: "",
  emp_size: "", turnover: "", erp_name: "", erp_vendor: "",
  head_office_location: "", source: "", source_1: "",
  address: "", location: "", city: "", state: "", zone: "", tier: "", pincode: "",
  activity_name: "",
  latest_disposition: "", latest_subdisposition: "",
  last_call_date: "", next_call_date: "",
  extra: "", extra_1: "", extra_2: "", remarks: "",
};

// ─── Helpers ───

function InfoRow({ icon: Icon, label, value, href }: {
  icon?: React.ElementType; label: string; value?: string | null; href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            {value} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-sm font-medium">{value}</p>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

// ─── Timeline Types ───

interface TimelineItem {
  id: string;
  type: "whatsapp" | "call" | "vapi_call" | "email" | "field_change";
  timestamp: string;
  data: any;
}

// ─── Timeline Hook ───

function useContactTimeline(demandcomId: string, phoneNumber?: string) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!demandcomId) return;
    let cancelled = false;

    async function fetchAll() {
      setIsLoading(true);
      try {
        const queries = [
          // WhatsApp messages
          supabase
            .from("whatsapp_messages")
            .select("*, sender:profiles!sent_by(full_name)")
            .eq("demandcom_id", demandcomId)
            .order("sent_at", { ascending: false })
            .limit(200),
          // Exotel/normal call logs
          supabase
            .from("call_logs" as any)
            .select("*, initiator:profiles!call_logs_initiated_by_fkey(full_name)")
            .eq("demandcom_id", demandcomId)
            .order("created_at", { ascending: false })
            .limit(200),
          // VAPI call logs
          supabase
            .from("vapi_call_logs")
            .select("*")
            .eq("demandcom_id", demandcomId)
            .order("created_at", { ascending: false })
            .limit(200),
          // Field changes (disposition updates, etc.)
          supabase
            .from("demandcom_field_changes" as any)
            .select("*, changer:profiles!demandcom_field_changes_changed_by_fkey(full_name)")
            .eq("demandcom_id", demandcomId)
            .order("changed_at", { ascending: false })
            .limit(200),
          // Email activity
          supabase
            .from("email_activity_log" as any)
            .select("*")
            .eq("demandcom_id", demandcomId)
            .order("sent_at", { ascending: false })
            .limit(200),
        ];

        const [waRes, callRes, vapiRes, fieldRes, emailRes] = await Promise.all(queries);

        if (cancelled) return;

        const timeline: TimelineItem[] = [];

        (waRes.data || []).forEach((m: any) =>
          timeline.push({ id: `wa-${m.id}`, type: "whatsapp", timestamp: m.sent_at || m.created_at, data: m })
        );
        (callRes.data || []).forEach((c: any) =>
          timeline.push({ id: `call-${c.id}`, type: "call", timestamp: c.start_time || c.created_at, data: c })
        );
        (vapiRes.data || []).forEach((v: any) =>
          timeline.push({ id: `vapi-${v.id}`, type: "vapi_call", timestamp: v.started_at || v.created_at, data: v })
        );
        (fieldRes.data || []).forEach((f: any) =>
          timeline.push({ id: `fc-${f.id}`, type: "field_change", timestamp: f.changed_at || f.created_at, data: f })
        );
        (emailRes.data || []).forEach((e: any) =>
          timeline.push({ id: `email-${e.id}`, type: "email", timestamp: e.sent_at, data: e })
        );

        timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setItems(timeline);
      } catch (err) {
        console.error("Timeline fetch error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [demandcomId, phoneNumber]);

  return { items, isLoading };
}

// ─── Timeline Renderers ───

function TimelineDateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <Badge variant="secondary" className="text-xs font-normal shrink-0">
        {format(new Date(date), "EEEE, MMMM d, yyyy")}
      </Badge>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function WhatsAppTimelineItem({ data }: { data: any }) {
  const isOutbound = data.direction === "outbound";
  const statusMap: Record<string, { icon: React.ElementType; color: string }> = {
    pending: { icon: Clock, color: "text-yellow-500" },
    sent: { icon: Send, color: "text-blue-500" },
    delivered: { icon: CheckCircle2, color: "text-green-500" },
    read: { icon: CheckCheck, color: "text-green-600" },
    failed: { icon: XCircle, color: "text-red-500" },
    received: { icon: MessageCircle, color: "text-purple-500" },
  };
  const st = statusMap[data.status] || statusMap.pending;
  const StatusIcon = st.icon;

  return (
    <div className="flex gap-3">
      <div className={cn("mt-1 rounded-full p-1.5 shrink-0", isOutbound ? "bg-green-100" : "bg-purple-100")}>
        <MessageSquare className={cn("h-3.5 w-3.5", isOutbound ? "text-green-600" : "text-purple-600")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium">
            {isOutbound ? `WhatsApp sent${data.sender?.full_name ? ` by ${data.sender.full_name}` : ""}` : "WhatsApp received"}
          </span>
          {data.template_name && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {data.template_name}
            </Badge>
          )}
        </div>
        <div className={cn(
          "rounded-lg px-3 py-2 text-sm max-w-[90%]",
          isOutbound ? "bg-green-50 border border-green-200" : "bg-purple-50 border border-purple-200"
        )}>
          <p className="whitespace-pre-wrap break-words">{data.message_content || "[No content]"}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">
            {data.sent_at ? format(new Date(data.sent_at), "hh:mm a") : format(new Date(data.created_at), "hh:mm a")}
          </span>
          <StatusIcon className={cn("h-3 w-3", st.color)} />
          <span className={cn("text-[10px]", st.color)}>{data.status}</span>
          {data.error_message && <span className="text-[10px] text-red-500">{data.error_message}</span>}
        </div>
      </div>
    </div>
  );
}

function CallTimelineItem({ data }: { data: any }) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const statusIcons: Record<string, React.ElementType> = {
    completed: PhoneCall,
    "no-answer": PhoneMissed,
    busy: PhoneMissed,
    failed: PhoneMissed,
    canceled: PhoneMissed,
    "in-progress": PhoneOutgoing,
    ringing: PhoneOutgoing,
    initiated: PhoneOutgoing,
  };
  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    "no-answer": "bg-orange-100 text-orange-700",
    busy: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    canceled: "bg-gray-100 text-gray-700",
    "in-progress": "bg-blue-100 text-blue-700",
    ringing: "bg-purple-100 text-purple-700",
    initiated: "bg-blue-100 text-blue-700",
  };
  const Icon = statusIcons[data.status] || PhoneCall;
  const badgeColor = statusColors[data.status] || "bg-gray-100 text-gray-700";
  const hasAnalysis = data.call_analysis?.status === "completed" && !data.call_analysis?.error;

  return (
    <div className="flex gap-3">
      <div className="mt-1 rounded-full p-1.5 bg-blue-100 shrink-0">
        <Icon className="h-3.5 w-3.5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-medium">
            {data.call_method === "screen" ? "Screen Call" : "Phone Call"}
            {data.initiator?.full_name ? ` by ${data.initiator.full_name}` : ""}
          </span>
          <Badge className={cn("text-[10px] h-4 px-1.5 border-0", badgeColor)}>
            {data.status}
          </Badge>
          {data.conversation_duration != null && data.conversation_duration > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {Math.floor(data.conversation_duration / 60)}m {data.conversation_duration % 60}s
            </span>
          )}
          {hasAnalysis && (
            <Badge className="text-[10px] h-4 px-1.5 border-0 bg-violet-100 text-violet-700">
              Score: {data.call_analysis.overall_score}/10
            </Badge>
          )}
        </div>
        {(data.disposition || data.subdisposition) && (
          <div className="flex items-center gap-1.5 mt-1">
            <Tag className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">
              {[data.disposition, data.subdisposition].filter(Boolean).join(" / ")}
            </span>
          </div>
        )}
        {data.notes && (
          <p className="text-xs text-muted-foreground mt-1 bg-muted rounded px-2 py-1">{data.notes}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {data.recording_url && (
            <a href={data.recording_url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline">
              Recording
            </a>
          )}
          {data.recording_url && (
            <button
              onClick={() => setAnalysisOpen(true)}
              className="text-[11px] text-violet-600 hover:underline flex items-center gap-0.5"
            >
              <Brain className="h-3 w-3" />
              {hasAnalysis ? "View Analysis" : "AI Analyze"}
            </button>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {format(new Date(data.start_time || data.created_at), "hh:mm a")}
          {data.to_number && <span className="ml-2">{data.to_number}</span>}
        </div>
      </div>
      <CallAnalysisDialog
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        callLogId={data.id}
        recordingUrl={data.recording_url}
        existingTranscript={data.transcript}
        existingAnalysis={data.call_analysis}
      />
    </div>
  );
}

function VapiCallTimelineItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false);
  const sentimentColors: Record<string, string> = {
    positive: "bg-green-100 text-green-700",
    neutral: "bg-yellow-100 text-yellow-700",
    negative: "bg-red-100 text-red-700",
  };
  const statusColors: Record<string, string> = {
    ended: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    queued: "bg-yellow-100 text-yellow-700",
    "in-progress": "bg-blue-100 text-blue-700",
  };
  const hasDetails = data.transcript || data.call_summary || data.response_summary;

  return (
    <div className="flex gap-3">
      <div className="mt-1 rounded-full p-1.5 bg-violet-100 shrink-0">
        <Bot className="h-3.5 w-3.5 text-violet-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-medium">VAPI AI Call</span>
          <Badge className={cn("text-[10px] h-4 px-1.5 border-0", statusColors[data.status] || "bg-gray-100 text-gray-700")}>
            {data.status}
          </Badge>
          {data.duration_seconds != null && data.duration_seconds > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {Math.floor(data.duration_seconds / 60)}m {data.duration_seconds % 60}s
            </span>
          )}
          {data.sentiment && (
            <Badge className={cn("text-[10px] h-4 px-1.5 border-0", sentimentColors[data.sentiment] || "")}>
              {data.sentiment}
              {data.sentiment_score != null && ` (${Math.round(data.sentiment_score * 100)}%)`}
            </Badge>
          )}
          {hasDetails && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
        </div>
        {data.key_topics && data.key_topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.key_topics.map((t: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] h-4 px-1">{t}</Badge>
            ))}
          </div>
        )}
        {expanded && (
          <div className="mt-2 space-y-2">
            {data.response_summary && (
              <div>
                <p className="text-[10px] font-medium flex items-center gap-1 mb-0.5"><Brain className="h-3 w-3" /> AI Summary</p>
                <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{data.response_summary}</p>
              </div>
            )}
            {data.call_summary && (
              <div>
                <p className="text-[10px] font-medium flex items-center gap-1 mb-0.5"><FileText className="h-3 w-3" /> Call Summary</p>
                <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{data.call_summary}</p>
              </div>
            )}
            {data.transcript && (
              <div>
                <p className="text-[10px] font-medium mb-0.5">Transcript</p>
                <pre className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {data.transcript}
                </pre>
              </div>
            )}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground mt-1">
          {format(new Date(data.started_at || data.created_at), "hh:mm a")}
        </div>
      </div>
    </div>
  );
}

function FieldChangeTimelineItem({ data }: { data: any }) {
  const fieldLabels: Record<string, string> = {
    latest_disposition: "Disposition",
    latest_subdisposition: "Sub-Disposition",
    disposition: "Disposition",
    subdisposition: "Sub-Disposition",
    company_name: "Company",
    name: "Name",
    mobile_numb: "Mobile",
    official: "Email",
    city: "City",
    state: "State",
    address: "Address",
    designation: "Designation",
    deppt: "Department",
  };
  const label = fieldLabels[data.field_name] || data.field_name;
  const isDisposition = data.field_name?.includes("disposition");

  return (
    <div className="flex gap-3">
      <div className={cn("mt-1 rounded-full p-1.5 shrink-0", isDisposition ? "bg-amber-100" : "bg-gray-100")}>
        <ArrowRightLeft className={cn("h-3.5 w-3.5", isDisposition ? "text-amber-600" : "text-gray-500")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{label} updated</span>
          {data.changer?.full_name && (
            <span className="text-[10px] text-muted-foreground">by {data.changer.full_name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs">
          {data.old_value && (
            <span className="line-through text-muted-foreground">{data.old_value}</span>
          )}
          {data.old_value && data.new_value && <span className="text-muted-foreground">&rarr;</span>}
          {data.new_value && (
            <span className="font-medium">{data.new_value}</span>
          )}
          {!data.old_value && !data.new_value && (
            <span className="text-muted-foreground italic">cleared</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {format(new Date(data.changed_at || data.created_at), "hh:mm a")}
        </div>
      </div>
    </div>
  );
}

function EmailTimelineItem({ data }: { data: any }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 rounded-full p-1.5 bg-sky-100 shrink-0">
        <Mail className="h-3.5 w-3.5 text-sky-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium">Email sent</span>
          {data.status && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">{data.status}</Badge>
          )}
        </div>
        {data.subject && (
          <p className="text-xs font-medium">{data.subject}</p>
        )}
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {format(new Date(data.sent_at), "hh:mm a")}
          {data.to_email && <span className="ml-2">to {data.to_email}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Contact Timeline Component ───

function ContactTimeline({ demandcomId, phoneNumber }: { demandcomId: string; phoneNumber?: string }) {
  const { items, isLoading } = useContactTimeline(demandcomId, phoneNumber);

  const grouped = useMemo(() => {
    const groups: { date: string; items: TimelineItem[] }[] = [];
    let currentDate = "";
    for (const item of items) {
      const d = format(new Date(item.timestamp), "yyyy-MM-dd");
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, items: [item] });
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    return groups;
  }, [items]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Clock className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-xs">Communication history will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
      <div className="px-1 py-2 space-y-3">
        {grouped.map(group => (
          <div key={group.date}>
            <TimelineDateSeparator date={group.date} />
            <div className="space-y-4">
              {group.items.map(item => {
                switch (item.type) {
                  case "whatsapp": return <WhatsAppTimelineItem key={item.id} data={item.data} />;
                  case "call": return <CallTimelineItem key={item.id} data={item.data} />;
                  case "vapi_call": return <VapiCallTimelineItem key={item.id} data={item.data} />;
                  case "field_change": return <FieldChangeTimelineItem key={item.id} data={item.data} />;
                  case "email": return <EmailTimelineItem key={item.id} data={item.data} />;
                  default: return null;
                }
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ─── Details View ───

function ParticipantDetails({
  formData, assignmentInfo, id, onEdit, onBack,
}: {
  formData: DemandComFormData;
  assignmentInfo: any;
  id: string;
  onEdit: () => void;
  onBack: () => void;
}) {
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);

  const fullName = [formData.salutation, formData.name].filter(Boolean).join(" ");
  const subtitle = [formData.designation, formData.company_name].filter(Boolean).join(" at ");
  const locationStr = [formData.city, formData.state, formData.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/5 via-success-green/5 to-accent-purple/5">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={rmplLogo} alt="RMPL Logo" className="h-10" />
          </div>
          <div className="flex items-center gap-2">
            {formData.mobile_numb && (
              <Button variant="outline" size="sm" onClick={() => setWhatsappDialogOpen(true)}
                className="border-green-300 hover:bg-green-50 gap-2">
                <MessageSquare className="h-4 w-4 text-green-600" />
                WhatsApp
              </Button>
            )}
            <Button size="sm" onClick={onEdit} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Profile header card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-5">
              <Avatar className="h-16 w-16 text-lg">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials(formData.name || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{fullName || "Unnamed"}</h1>
                {subtitle && <p className="text-muted-foreground mt-0.5">{subtitle}</p>}
                {locationStr && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" /> {locationStr}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.latest_disposition && (
                    <Badge variant="outline">{formData.latest_disposition}</Badge>
                  )}
                  {formData.latest_subdisposition && (
                    <Badge variant="secondary">{formData.latest_subdisposition}</Badge>
                  )}
                  {assignmentInfo?.assignment_status && (
                    <Badge variant={assignmentInfo.assignment_status === "assigned" ? "default" : "secondary"}>
                      {assignmentInfo.assignment_status === "assigned"
                        ? `Assigned to ${assignmentInfo.assigned_to_name || "—"}`
                        : assignmentInfo.assignment_status}
                    </Badge>
                  )}
                  {formData.activity_name && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {formData.activity_name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Info cards */}
          <div className="space-y-4">
            {/* Contact Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <InfoRow icon={Phone} label="Mobile" value={formData.mobile_numb} href={`tel:${formData.mobile_numb}`} />
                <InfoRow icon={Phone} label="Mobile 2" value={formData.mobile2} href={formData.mobile2 ? `tel:${formData.mobile2}` : undefined} />
                <InfoRow icon={Mail} label="Official Email" value={formData.official} href={formData.official ? `mailto:${formData.official}` : undefined} />
                <InfoRow icon={Mail} label="Personal Email" value={formData.personal_email_id} href={formData.personal_email_id ? `mailto:${formData.personal_email_id}` : undefined} />
                <InfoRow icon={Mail} label="Generic Email" value={formData.generic_email_id} href={formData.generic_email_id ? `mailto:${formData.generic_email_id}` : undefined} />
                <InfoRow icon={Linkedin} label="LinkedIn" value={formData.linkedin ? "View Profile" : undefined} href={formData.linkedin || undefined} />
                <InfoRow icon={Linkedin} label="Company LinkedIn" value={formData.company_linkedin_url ? "View Page" : undefined} href={formData.company_linkedin_url || undefined} />
              </CardContent>
            </Card>

            {/* Professional Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Professional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <InfoRow icon={User} label="Designation" value={formData.designation} />
                <InfoRow icon={Briefcase} label="Department" value={formData.deppt} />
                <InfoRow icon={Briefcase} label="Job Level" value={formData.job_level_updated} />
                <InfoRow icon={Globe} label="Country" value={formData.country} />
              </CardContent>
            </Card>

            {/* Company Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Company
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <InfoRow icon={Building2} label="Company" value={formData.company_name} />
                <InfoRow icon={Briefcase} label="Industry" value={[formData.industry_type, formData.sub_industry].filter(Boolean).join(" / ") || undefined} />
                <InfoRow icon={Globe} label="Website" value={formData.website ? formData.website.replace(/^https?:\/\//, "") : undefined} href={formData.website || undefined} />
                <InfoRow label="Employee Size" value={formData.emp_size} />
                <InfoRow label="Turnover" value={formData.turnover} />
                <InfoRow label="ERP" value={[formData.erp_name, formData.erp_vendor].filter(Boolean).join(" — ") || undefined} />
                <InfoRow label="Head Office" value={formData.head_office_location} />
                <InfoRow label="Source" value={[formData.source, formData.source_1].filter(Boolean).join(", ") || undefined} />
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {formData.address && <InfoRow icon={MapPin} label="Address" value={formData.address} />}
                <InfoRow label="Location" value={formData.location} />
                <InfoRow label="City" value={formData.city} />
                <InfoRow label="State" value={formData.state} />
                <InfoRow label="Pincode" value={formData.pincode} />
                <InfoRow label="Zone / Tier" value={[formData.zone, formData.tier].filter(Boolean).join(" / ") || undefined} />
              </CardContent>
            </Card>

            {/* Assignment */}
            {assignmentInfo?.assignment_status && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" /> Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5">
                  <InfoRow label="Status" value={assignmentInfo.assignment_status} />
                  <InfoRow label="Assigned To" value={assignmentInfo.assigned_to_name} />
                  <InfoRow label="Assigned By" value={assignmentInfo.assigned_by_name} />
                  {assignmentInfo.assigned_at && (
                    <InfoRow label="Assigned At" value={new Date(assignmentInfo.assigned_at).toLocaleString()} />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Remarks & Notes */}
            {(formData.remarks || formData.extra || formData.extra_1 || formData.extra_2) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.remarks && <p className="text-sm whitespace-pre-wrap">{formData.remarks}</p>}
                  {(formData.extra || formData.extra_1 || formData.extra_2) && (
                    <>
                      {formData.remarks && <Separator className="my-2" />}
                      <div className="space-y-1">
                        {formData.extra && <p className="text-xs"><span className="text-muted-foreground">Extra:</span> {formData.extra}</p>}
                        {formData.extra_1 && <p className="text-xs"><span className="text-muted-foreground">Extra 1:</span> {formData.extra_1}</p>}
                        {formData.extra_2 && <p className="text-xs"><span className="text-muted-foreground">Extra 2:</span> {formData.extra_2}</p>}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Unified Contact History Timeline */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Contact History
                </CardTitle>
                {formData.mobile_numb && (
                  <Button size="sm" variant="outline" onClick={() => setWhatsappDialogOpen(true)}
                    className="border-green-300 hover:bg-green-50 gap-2 h-8">
                    <MessageSquare className="h-3.5 w-3.5 text-green-600" /> Send WhatsApp
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <ContactTimeline demandcomId={id} phoneNumber={formData.mobile_numb} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* WhatsApp Send Dialog */}
      {formData.mobile_numb && (
        <SendWhatsAppDialog
          open={whatsappDialogOpen}
          onOpenChange={setWhatsappDialogOpen}
          demandcomId={id}
          contactName={formData.name}
          phoneNumber={formData.mobile_numb}
        />
      )}
    </div>
  );
}

// ─── Edit Form ───

function ParticipantEditForm({
  formData: initialFormData,
  isNew,
  id,
  onCancel,
  onSaved,
  lastCallDateInit,
  nextCallDateInit,
}: {
  formData: DemandComFormData;
  isNew: boolean;
  id?: string;
  onCancel: () => void;
  onSaved: () => void;
  lastCallDateInit?: Date;
  nextCallDateInit?: Date;
}) {
  const [formData, setFormData] = useState<DemandComFormData>({ ...initialFormData });
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [lastCallDate, setLastCallDate] = useState<Date | undefined>(lastCallDateInit);
  const [nextCallDate, setNextCallDate] = useState<Date | undefined>(nextCallDateInit);

  const updateFormData = (field: keyof DemandComFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      demandComSchema.parse(formData);
      setIsLoading(true);
      setValidationErrors({});

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const demandComData: any = {
        salutation: formData.salutation || null,
        name: formData.name,
        mobile_numb: formData.mobile_numb,
        mobile2: formData.mobile2 || null,
        official: formData.official || null,
        personal_email_id: formData.personal_email_id || null,
        generic_email_id: formData.generic_email_id || null,
        linkedin: formData.linkedin || null,
        company_linkedin_url: formData.company_linkedin_url || null,
        associated_member_linkedin: formData.associated_member_linkedin || null,
        turnover_link: formData.turnover_link || null,
        designation: formData.designation || null,
        deppt: formData.deppt || null,
        job_level_updated: formData.job_level_updated || null,
        country: formData.country || null,
        company_name: formData.company_name || null,
        industry_type: formData.industry_type || null,
        sub_industry: formData.sub_industry || null,
        website: formData.website || null,
        emp_size: formData.emp_size || null,
        turnover: formData.turnover || null,
        erp_name: formData.erp_name || null,
        erp_vendor: formData.erp_vendor || null,
        head_office_location: formData.head_office_location || null,
        source: formData.source || null,
        source_1: formData.source_1 || null,
        address: formData.address || null,
        location: formData.location || null,
        city: formData.city || null,
        state: formData.state || null,
        zone: formData.zone || null,
        tier: formData.tier || null,
        pincode: formData.pincode || null,
        activity_name: formData.activity_name || null,
        last_call_date: lastCallDate ? lastCallDate.toISOString() : null,
        next_call_date: nextCallDate ? nextCallDate.toISOString() : null,
        extra: formData.extra || null,
        extra_1: formData.extra_1 || null,
        extra_2: formData.extra_2 || null,
        remarks: formData.remarks || null,
        created_by: user.id,
      };

      if (!isNew && id) {
        demandComData.updated_by = user.id;
        const { error } = await supabase.from("demandcom" as any).update(demandComData).eq("id", id);
        if (error) throw error;
        toast.success("Participant updated successfully");
      } else {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          demandComData.assigned_to = u.id;
          demandComData.assigned_by = u.id;
          demandComData.assigned_at = new Date().toISOString();
          demandComData.assignment_status = "assigned";
        }
        const { error } = await supabase.from("demandcom" as any).insert([demandComData]);
        if (error) throw error;
        toast.success("Participant created successfully");
      }
      onSaved();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => { if (err.path[0]) errors[err.path[0].toString()] = err.message; });
        setValidationErrors(errors);
        toast.error("Please fix the validation errors");
      } else {
        toast.error(error.message || "Failed to save participant");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const field = (fld: keyof DemandComFormData, label: string, opts?: { type?: string; required?: boolean; placeholder?: string }) => (
    <div>
      <Label htmlFor={fld}>{label}{opts?.required ? " *" : ""}</Label>
      <Input id={fld} type={opts?.type || "text"} placeholder={opts?.placeholder}
        value={formData[fld] || ""} onChange={(e) => updateFormData(fld, e.target.value)}
        required={opts?.required} />
      {validationErrors[fld] && <p className="text-sm text-destructive mt-1">{validationErrors[fld]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/5 via-success-green/5 to-accent-purple/5">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={rmplLogo} alt="RMPL Logo" className="h-10" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Saving..." : isNew ? "Create" : "Save Changes"}
            </Button>
          </div>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>{isNew ? "Add" : "Edit"} Participant</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Salutation</Label>
                    <Select value={formData.salutation} onValueChange={(v) => updateFormData("salutation", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{SALUTATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {field("name", "Full Name", { required: true })}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field("mobile_numb", "Mobile Number", { required: true })}
                  {field("mobile2", "Mobile Number 2")}
                  {field("official", "Official Email", { type: "email" })}
                  {field("personal_email_id", "Personal Email", { type: "email" })}
                  {field("generic_email_id", "Generic/Company Email", { type: "email" })}
                  {field("linkedin", "LinkedIn Profile", { type: "url", placeholder: "https://linkedin.com/in/..." })}
                  {field("company_linkedin_url", "Company LinkedIn URL", { type: "url", placeholder: "https://linkedin.com/company/..." })}
                  {field("associated_member_linkedin", "Associated Member LinkedIn", { type: "url" })}
                  {field("turnover_link", "Turnover Link", { type: "url" })}
                </div>
              </div>

              {/* Professional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field("designation", "Designation")}
                  {field("deppt", "Department")}
                  {field("job_level_updated", "Job Level")}
                  <div>
                    <Label>Country</Label>
                    <Select value={formData.country} onValueChange={(v) => updateFormData("country", v)}>
                      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field("company_name", "Company Name")}
                  {field("industry_type", "Industry Type")}
                  {field("sub_industry", "Sub Industry")}
                  {field("website", "Website", { type: "url", placeholder: "https://example.com" })}
                  {field("emp_size", "Employee Size")}
                  {field("turnover", "Turnover")}
                  {field("erp_name", "ERP Name")}
                  {field("erp_vendor", "ERP Vendor")}
                  {field("head_office_location", "Head Office Location")}
                  {field("source", "Source")}
                  {field("source_1", "Source 1")}
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Location Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    <Textarea value={formData.address} onChange={(e) => updateFormData("address", e.target.value)} rows={3} />
                  </div>
                  {field("location", "Location")}
                  {field("city", "City")}
                  <div>
                    <Label>State</Label>
                    <Select value={formData.state} onValueChange={(v) => updateFormData("state", v)}>
                      <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {field("pincode", "Pincode")}
                  {field("zone", "Zone")}
                  {field("tier", "Tier")}
                </div>
              </div>

              {/* Activity & Call Tracking */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Activity & Call Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field("activity_name", "Activity Name", { placeholder: "e.g., Conference 2024" })}
                  <div /> {/* spacer */}
                  <div>
                    <Label>Last Call Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !lastCallDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {lastCallDate ? format(lastCallDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={lastCallDate} onSelect={setLastCallDate} initialFocus className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Next Call Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !nextCallDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {nextCallDate ? format(nextCallDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={nextCallDate} onSelect={setNextCallDate} initialFocus className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Additional Fields */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Additional Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {field("extra", "Extra")}
                  {field("extra_1", "Extra 1")}
                  {field("extra_2", "Extra 2")}
                </div>
                <div>
                  <Label>Remarks</Label>
                  <Textarea value={formData.remarks} onChange={(e) => updateFormData("remarks", e.target.value)} rows={4} placeholder="Any additional notes..." />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 justify-end pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : isNew ? "Create Participant" : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page Component ───

export default function DemandComForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isExisting = Boolean(id);

  const [formData, setFormData] = useState<DemandComFormData>({ ...emptyForm });
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState(!isExisting); // new = edit mode, existing = view mode
  const [lastCallDate, setLastCallDate] = useState<Date | undefined>();
  const [nextCallDate, setNextCallDate] = useState<Date | undefined>();
  const [assignmentInfo, setAssignmentInfo] = useState<any>({});

  useEffect(() => {
    checkAuth();
    if (isExisting) loadDemandCom();
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const loadDemandCom = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("demandcom" as any).select("*").eq("id", id).single();
      if (error) throw error;
      if (!data) return;

      const r = data as any;
      setFormData({
        salutation: r.salutation || "", name: r.name || "",
        mobile_numb: r.mobile_numb || "", mobile2: r.mobile2 || "",
        official: r.official || "", personal_email_id: r.personal_email_id || "",
        generic_email_id: r.generic_email_id || "", linkedin: r.linkedin || "",
        company_linkedin_url: r.company_linkedin_url || "",
        associated_member_linkedin: r.associated_member_linkedin || "",
        turnover_link: r.turnover_link || "",
        designation: r.designation || "", deppt: r.deppt || "",
        job_level_updated: r.job_level_updated || "", country: r.country || "",
        company_name: r.company_name || "", industry_type: r.industry_type || "",
        sub_industry: r.sub_industry || "", website: r.website || "",
        emp_size: r.emp_size || "", turnover: r.turnover || "",
        erp_name: r.erp_name || "", erp_vendor: r.erp_vendor || "",
        head_office_location: r.head_office_location || "",
        source: r.source || "", source_1: r.source_1 || "",
        address: r.address || "", location: r.location || "",
        city: r.city || "", state: r.state || "",
        zone: r.zone || "", tier: r.tier || "", pincode: r.pincode || "",
        activity_name: r.activity_name || "",
        latest_disposition: r.latest_disposition || "",
        latest_subdisposition: r.latest_subdisposition || "",
        last_call_date: r.last_call_date || "", next_call_date: r.next_call_date || "",
        extra: r.extra || "", extra_1: r.extra_1 || "",
        extra_2: r.extra_2 || "", remarks: r.remarks || "",
      });

      if (r.last_call_date) setLastCallDate(new Date(r.last_call_date));
      if (r.next_call_date) setNextCallDate(new Date(r.next_call_date));

      const info: any = {
        assignment_status: r.assignment_status,
        assigned_to: r.assigned_to,
        assigned_by: r.assigned_by,
        assigned_at: r.assigned_at,
      };
      if (r.assigned_to) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", r.assigned_to).single();
        info.assigned_to_name = p?.full_name || "Unknown";
      }
      if (r.assigned_by) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", r.assigned_by).single();
        info.assigned_by_name = p?.full_name || "Unknown";
      }
      setAssignmentInfo(info);
    } catch (error: any) {
      toast.error(error.message || "Failed to load participant data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && isExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Existing participant: show details or edit
  if (isExisting && id) {
    if (editing) {
      return (
        <ParticipantEditForm
          formData={formData}
          isNew={false}
          id={id}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); loadDemandCom(); }}
          lastCallDateInit={lastCallDate}
          nextCallDateInit={nextCallDate}
        />
      );
    }
    return (
      <ParticipantDetails
        formData={formData}
        assignmentInfo={assignmentInfo}
        id={id}
        onEdit={() => setEditing(true)}
        onBack={() => navigate("/demandcom")}
      />
    );
  }

  // New participant: always show form
  return (
    <ParticipantEditForm
      formData={formData}
      isNew={true}
      onCancel={() => navigate("/demandcom")}
      onSaved={() => navigate("/demandcom")}
    />
  );
}
