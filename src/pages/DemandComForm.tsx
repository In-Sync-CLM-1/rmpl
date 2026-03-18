import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import rmplLogo from "@/assets/rmpl-logo.png";
import { VapiCallHistory } from "@/components/VapiCallHistory";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function DemandComForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState<DemandComFormData>({
    salutation: "",
    name: "",
    mobile_numb: "",
    mobile2: "",
    official: "",
    personal_email_id: "",
    generic_email_id: "",
    linkedin: "",
    company_linkedin_url: "",
    associated_member_linkedin: "",
    turnover_link: "",
    
    designation: "",
    deppt: "",
    job_level_updated: "",
    country: "",
    
    company_name: "",
    industry_type: "",
    sub_industry: "",
    website: "",
    emp_size: "",
    turnover: "",
    erp_name: "",
    erp_vendor: "",
    head_office_location: "",
    source: "",
    source_1: "",
    
    address: "",
    location: "",
    city: "",
    state: "",
    zone: "",
    tier: "",
    pincode: "",
    
    activity_name: "",
    
    latest_disposition: "",
    latest_subdisposition: "",
    last_call_date: "",
    next_call_date: "",
    
    extra: "",
    extra_1: "",
    extra_2: "",
    remarks: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [lastCallDate, setLastCallDate] = useState<Date | undefined>();
  const [nextCallDate, setNextCallDate] = useState<Date | undefined>();
  const [assignmentInfo, setAssignmentInfo] = useState<{
    assignment_status?: string;
    assigned_to?: string;
    assigned_to_name?: string;
    assigned_by?: string;
    assigned_by_name?: string;
    assigned_at?: string;
  }>({});

  useEffect(() => {
    checkAuth();
    if (isEditMode) {
      loadDemandCom();
    }
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadDemandCom = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("demandcom" as any)
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        const record = data as any;
        setFormData({
          salutation: record.salutation || "",
          name: record.name || "",
          mobile_numb: record.mobile_numb || "",
          mobile2: record.mobile2 || "",
          official: record.official || "",
          personal_email_id: record.personal_email_id || "",
          generic_email_id: record.generic_email_id || "",
          linkedin: record.linkedin || "",
          company_linkedin_url: record.company_linkedin_url || "",
          associated_member_linkedin: record.associated_member_linkedin || "",
          turnover_link: record.turnover_link || "",
          
          designation: record.designation || "",
          deppt: record.deppt || "",
          job_level_updated: record.job_level_updated || "",
          country: record.country || "",
          
          company_name: record.company_name || "",
          industry_type: record.industry_type || "",
          sub_industry: record.sub_industry || "",
          website: record.website || "",
          emp_size: record.emp_size || "",
          turnover: record.turnover || "",
          erp_name: record.erp_name || "",
          erp_vendor: record.erp_vendor || "",
          head_office_location: record.head_office_location || "",
          source: record.source || "",
          source_1: record.source_1 || "",
          
          address: record.address || "",
          location: record.location || "",
          city: record.city || "",
          state: record.state || "",
          zone: record.zone || "",
          tier: record.tier || "",
          pincode: record.pincode || "",
          
          activity_name: record.activity_name || "",
          
          latest_disposition: record.latest_disposition || "",
          latest_subdisposition: record.latest_subdisposition || "",
          last_call_date: record.last_call_date || "",
          next_call_date: record.next_call_date || "",
          
          extra: record.extra || "",
          extra_1: record.extra_1 || "",
          extra_2: record.extra_2 || "",
          remarks: record.remarks || "",
        });

        // Set date objects for date pickers
        if (record.last_call_date) {
          setLastCallDate(new Date(record.last_call_date));
        }
        if (record.next_call_date) {
          setNextCallDate(new Date(record.next_call_date));
        }

        // Load assignment information
        const assignmentData: any = {
          assignment_status: record.assignment_status,
          assigned_to: record.assigned_to,
          assigned_by: record.assigned_by,
          assigned_at: record.assigned_at,
        };

        // Fetch agent names
        if (record.assigned_to) {
          const { data: assignedToProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", record.assigned_to)
            .single();
          assignmentData.assigned_to_name = assignedToProfile?.full_name || "Unknown";
        }

        if (record.assigned_by) {
          const { data: assignedByProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", record.assigned_by)
            .single();
          assignmentData.assigned_by_name = assignedByProfile?.full_name || "Unknown";
        }

        setAssignmentInfo(assignmentData);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load participant data");
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: keyof DemandComFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
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

      if (isEditMode) {
        const { error } = await supabase
          .from("demandcom" as any)
          .update(demandComData)
          .eq("id", id);

        if (error) throw error;
        toast.success("Participant updated successfully");
      } else {
        // Auto-assign new record to creator
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          demandComData.assigned_to = user.id;
          demandComData.assigned_by = user.id;
          demandComData.assigned_at = new Date().toISOString();
          demandComData.assignment_status = 'assigned';
        }
        
        const { error } = await supabase
          .from("demandcom" as any)
          .insert([demandComData]);

        if (error) throw error;
        toast.success("Participant created successfully");
      }

      navigate("/demandcom");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setValidationErrors(errors);
        toast.error("Please fix the validation errors");
      } else {
        toast.error(error.message || "Failed to save participant");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && isEditMode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/5 via-success-green/5 to-accent-purple/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/demandcom")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={rmplLogo} alt="RMPL Logo" className="h-12" />
          </div>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>{isEditMode ? "Edit" : "Add"} Participant</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="salutation">Salutation</Label>
                    <Select
                      value={formData.salutation}
                      onValueChange={(value) => updateFormData("salutation", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select salutation" />
                      </SelectTrigger>
                      <SelectContent>
                        {SALUTATIONS.map((sal) => (
                          <SelectItem key={sal} value={sal}>
                            {sal}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateFormData("name", e.target.value)}
                      required
                    />
                    {validationErrors.name && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.name}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mobile_numb">Mobile Number *</Label>
                    <Input
                      id="mobile_numb"
                      value={formData.mobile_numb}
                      onChange={(e) => updateFormData("mobile_numb", e.target.value)}
                      required
                    />
                    {validationErrors.mobile_numb && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.mobile_numb}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="mobile2">Mobile Number 2</Label>
                    <Input
                      id="mobile2"
                      value={formData.mobile2}
                      onChange={(e) => updateFormData("mobile2", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="official">Official Email</Label>
                    <Input
                      id="official"
                      type="email"
                      value={formData.official}
                      onChange={(e) => updateFormData("official", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="personal_email_id">Personal Email</Label>
                    <Input
                      type="email"
                      id="personal_email_id"
                      value={formData.personal_email_id}
                      onChange={(e) => updateFormData("personal_email_id", e.target.value)}
                    />
                    {validationErrors.personal_email_id && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.personal_email_id}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="generic_email_id">Generic/Company Email</Label>
                    <Input
                      type="email"
                      id="generic_email_id"
                      value={formData.generic_email_id}
                      onChange={(e) => updateFormData("generic_email_id", e.target.value)}
                    />
                    {validationErrors.generic_email_id && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.generic_email_id}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="linkedin">LinkedIn Profile</Label>
                    <Input
                      type="url"
                      id="linkedin"
                      value={formData.linkedin}
                      onChange={(e) => updateFormData("linkedin", e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                    />
                    {validationErrors.linkedin && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.linkedin}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="company_linkedin_url">Company LinkedIn URL</Label>
                    <Input
                      type="url"
                      id="company_linkedin_url"
                      value={formData.company_linkedin_url}
                      onChange={(e) => updateFormData("company_linkedin_url", e.target.value)}
                      placeholder="https://linkedin.com/company/..."
                    />
                    {validationErrors.company_linkedin_url && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.company_linkedin_url}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="associated_member_linkedin">Associated Member LinkedIn</Label>
                    <Input
                      type="url"
                      id="associated_member_linkedin"
                      value={formData.associated_member_linkedin}
                      onChange={(e) => updateFormData("associated_member_linkedin", e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                    />
                    {validationErrors.associated_member_linkedin && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.associated_member_linkedin}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="turnover_link">Turnover Link</Label>
                    <Input
                      type="url"
                      id="turnover_link"
                      value={formData.turnover_link}
                      onChange={(e) => updateFormData("turnover_link", e.target.value)}
                      placeholder="https://..."
                    />
                    {validationErrors.turnover_link && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.turnover_link}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      value={formData.designation}
                      onChange={(e) => updateFormData("designation", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deppt">Department</Label>
                    <Input
                      id="deppt"
                      value={formData.deppt}
                      onChange={(e) => updateFormData("deppt", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="job_level_updated">Job Level</Label>
                    <Input
                      id="job_level_updated"
                      value={formData.job_level_updated}
                      onChange={(e) => updateFormData("job_level_updated", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => updateFormData("country", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => updateFormData("company_name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry_type">Industry Type</Label>
                    <Input
                      id="industry_type"
                      value={formData.industry_type}
                      onChange={(e) => updateFormData("industry_type", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sub_industry">Sub Industry</Label>
                    <Input
                      id="sub_industry"
                      value={formData.sub_industry}
                      onChange={(e) => updateFormData("sub_industry", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      type="url"
                      id="website"
                      value={formData.website}
                      onChange={(e) => updateFormData("website", e.target.value)}
                      placeholder="https://example.com"
                    />
                    {validationErrors.website && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.website}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="emp_size">Employee Size</Label>
                    <Input
                      id="emp_size"
                      value={formData.emp_size}
                      onChange={(e) => updateFormData("emp_size", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="turnover">Turnover</Label>
                    <Input
                      id="turnover"
                      value={formData.turnover}
                      onChange={(e) => updateFormData("turnover", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="erp_name">ERP Name</Label>
                    <Input
                      id="erp_name"
                      value={formData.erp_name}
                      onChange={(e) => updateFormData("erp_name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="erp_vendor">ERP Vendor</Label>
                    <Input
                      id="erp_vendor"
                      value={formData.erp_vendor}
                      onChange={(e) => updateFormData("erp_vendor", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="head_office_location">Head Office Location</Label>
                    <Input
                      id="head_office_location"
                      value={formData.head_office_location}
                      onChange={(e) => updateFormData("head_office_location", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={formData.source}
                      onChange={(e) => updateFormData("source", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="source_1">Source 1</Label>
                    <Input
                      id="source_1"
                      value={formData.source_1}
                      onChange={(e) => updateFormData("source_1", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Location Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => updateFormData("address", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => updateFormData("location", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateFormData("city", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => updateFormData("state", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => updateFormData("pincode", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zone">Zone</Label>
                    <Input
                      id="zone"
                      value={formData.zone}
                      onChange={(e) => updateFormData("zone", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tier">Tier</Label>
                    <Input
                      id="tier"
                      value={formData.tier}
                      onChange={(e) => updateFormData("tier", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Activity Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Activity Information</h3>
                <div>
                  <Label htmlFor="activity_name">Activity Name</Label>
                  <Input
                    id="activity_name"
                    value={formData.activity_name}
                    onChange={(e) => updateFormData("activity_name", e.target.value)}
                    placeholder="e.g., Conference 2024, Webinar Series"
                  />
                </div>
              </div>

              {/* Assignment Information (Read-Only) */}
              {isEditMode && assignmentInfo.assignment_status && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Assignment Information</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <Label>Status:</Label>
                      <Badge variant={assignmentInfo.assignment_status === 'assigned' ? 'default' : 'secondary'}>
                        {assignmentInfo.assignment_status || "Unassigned"}
                      </Badge>
                    </div>
                    {assignmentInfo.assigned_to_name && (
                      <div className="flex justify-between items-center">
                        <Label>Assigned To:</Label>
                        <span className="text-sm font-medium">{assignmentInfo.assigned_to_name}</span>
                      </div>
                    )}
                    {assignmentInfo.assigned_by_name && (
                      <div className="flex justify-between items-center">
                        <Label>Assigned By:</Label>
                        <span className="text-sm font-medium">{assignmentInfo.assigned_by_name}</span>
                      </div>
                    )}
                    {assignmentInfo.assigned_at && (
                      <div className="flex justify-between">
                        <Label>Assigned At:</Label>
                        <span className="text-sm text-muted-foreground">
                          {new Date(assignmentInfo.assigned_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Call Tracking Information */}
              {isEditMode && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Call Tracking</h3>
                  <div className="space-y-4">
                    {(formData.latest_disposition || formData.latest_subdisposition) && (
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Latest Disposition:</Label>
                          <Badge variant="outline">
                            {formData.latest_disposition || "No calls yet"}
                          </Badge>
                        </div>
                        {formData.latest_subdisposition && (
                          <div className="flex justify-between items-center">
                            <Label>Sub-disposition:</Label>
                            <Badge variant="secondary">
                              {formData.latest_subdisposition}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <Label>Last Call Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !lastCallDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {lastCallDate ? format(lastCallDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={lastCallDate}
                            onSelect={setLastCallDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Next Call Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !nextCallDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {nextCallDate ? format(nextCallDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={nextCallDate}
                            onSelect={setNextCallDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              )}

              {/* VAPI Call History & Responses */}
              {isEditMode && id && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">VAPI Call History & Responses</h3>
                  <VapiCallHistory demandcomId={id} />
                </div>
              )}

              {/* Additional Fields */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Additional Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="extra">Extra</Label>
                    <Input
                      id="extra"
                      value={formData.extra}
                      onChange={(e) => updateFormData("extra", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="extra_1">Extra 1</Label>
                    <Input
                      id="extra_1"
                      value={formData.extra_1}
                      onChange={(e) => updateFormData("extra_1", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="extra_2">Extra 2</Label>
                    <Input
                      id="extra_2"
                      value={formData.extra_2}
                      onChange={(e) => updateFormData("extra_2", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => updateFormData("remarks", e.target.value)}
                    rows={4}
                    placeholder="Any additional notes or remarks..."
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/demandcom")}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : isEditMode ? "Update" : "Create"} Participant
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
