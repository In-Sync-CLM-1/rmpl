import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import rmplLogo from "@/assets/rmpl-logo.png";
import { VapiCallHistory } from "@/components/VapiCallHistory";
import { SendWhatsAppDialog } from "@/components/whatsapp/SendWhatsAppDialog";
import { WhatsAppHistory } from "@/components/whatsapp/WhatsAppHistory";
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
          </div>

          {/* Right: Communication & Activity */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="whatsapp" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="whatsapp" className="gap-2">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </TabsTrigger>
                <TabsTrigger value="calls" className="gap-2">
                  <Phone className="h-4 w-4" /> Call History
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2">
                  <Clock className="h-4 w-4" /> Activity & Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="whatsapp" className="mt-4">
                <Card>
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm">WhatsApp Conversation</CardTitle>
                    {formData.mobile_numb && (
                      <Button size="sm" variant="outline" onClick={() => setWhatsappDialogOpen(true)}
                        className="border-green-300 hover:bg-green-50 gap-2 h-8">
                        <MessageSquare className="h-3.5 w-3.5 text-green-600" /> Send
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {formData.mobile_numb ? (
                      <WhatsAppHistory demandcomId={id} phoneNumber={formData.mobile_numb} maxHeight="500px" />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No mobile number available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="calls" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">VAPI Call History & Responses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VapiCallHistory demandcomId={id} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="mt-4 space-y-4">
                {/* Call Tracking */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Call Tracking</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Latest Disposition</p>
                        <p className="text-sm font-medium mt-0.5">{formData.latest_disposition || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sub-Disposition</p>
                        <p className="text-sm font-medium mt-0.5">{formData.latest_subdisposition || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Call Date</p>
                        <p className="text-sm font-medium mt-0.5">
                          {formData.last_call_date ? format(new Date(formData.last_call_date), "PPP") : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Next Call Date</p>
                        <p className="text-sm font-medium mt-0.5">
                          {formData.next_call_date ? format(new Date(formData.next_call_date), "PPP") : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Remarks & Notes */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Remarks & Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{formData.remarks || "No remarks."}</p>
                    {(formData.extra || formData.extra_1 || formData.extra_2) && (
                      <>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-3 gap-3">
                          {formData.extra && <div><p className="text-xs text-muted-foreground">Extra</p><p className="text-sm">{formData.extra}</p></div>}
                          {formData.extra_1 && <div><p className="text-xs text-muted-foreground">Extra 1</p><p className="text-sm">{formData.extra_1}</p></div>}
                          {formData.extra_2 && <div><p className="text-xs text-muted-foreground">Extra 2</p><p className="text-sm">{formData.extra_2}</p></div>}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
