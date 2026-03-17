import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, CalendarIcon, Save, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DemandComData {
  id: string;
  name: string;
  salutation?: string | null;
  mobile_numb: string;
  mobile2?: string | null;
  official?: string | null;
  personal_email_id?: string | null;
  generic_email_id?: string | null;
  linkedin?: string | null;
  designation?: string | null;
  deppt?: string | null;
  job_level_updated?: string | null;
  company_name?: string | null;
  company_linkedin_url?: string | null;
  associated_member_linkedin?: string | null;
  industry_type?: string | null;
  sub_industry?: string | null;
  address?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zone?: string | null;
  tier?: string | null;
  pincode?: string | null;
  website?: string | null;
  turnover?: string | null;
  turnover_link?: string | null;
  emp_size?: string | null;
  erp_name?: string | null;
  erp_vendor?: string | null;
  head_office_location?: string | null;
  latest_disposition?: string | null;
  latest_subdisposition?: string | null;
  next_call_date?: string | null;
  remarks?: string | null;
  source?: string | null;
  source_1?: string | null;
  extra?: string | null;
  extra_1?: string | null;
  extra_2?: string | null;
}

interface EnhancedCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandcomData: DemandComData;
  onCallInitiated?: () => void;
}

interface CallDisposition {
  disposition: string;
  subdispositions: string[];
}

const TURNOVER_RANGES = [
  "Below 1 Crs",
  "1-5 Crs",
  "5-10 Crs",
  "10-25 Crs",
  "25-50 Crs",
  "50-100 Crs",
  "100-250 Crs",
  "250-500 Crs",
  "500-1000 Crs",
  "1000-5000 Crs",
  "5000-10000 Crs",
  "10,000+ Crs"
];

const EMPLOYEE_SIZE_RANGES = [
  "1-10 EMP",
  "10-25 EMP",
  "25-50 EMP",
  "50-100 EMP",
  "100-250 EMP",
  "250-500 EMP",
  "500-1000 EMP",
  "1000-5000 EMP",
  "5000-10000 EMP",
  "10,000+ EMP"
];

const INDUSTRY_TYPES = [
  "IT/ITES",
  "BFSI (Banking, Financial Services & Insurance)",
  "Manufacturing",
  "Education",
  "Retail",
  "Real Estate / Construction / Infrastructure",
  "Engineering",
  "Services Industry",
  "Pharmaceutical / Biotech / Research / Laboratory",
  "Automobile / Automotive",
  "Electrical / Electronics",
  "NBFC",
  "Publication / Media / Entertainment",
  "Garments / Textile",
  "Telecommunications",
  "Healthcare",
  "Iron / Steel / Alloy",
  "Couriers / Logistics / Transportation",
  "Advertising / PR / Marketing Services",
  "Professional Services",
  "Conglomerate",
  "BPO / KPO / LPO",
  "Plastic / Rubber",
  "FMCG",
  "Power / Energy",
  "Petrochemicals / Chemical",
  "PSU / Government",
  "Metal & Mining",
  "Agricultural / Fertilizer",
  "Hospital / Clinic",
  "Fintech",
  "Travels / Tourism",
  "Hospitality",
  "Oil / Gas / Refiners",
  "Export / Import",
  "Architecture & Interior Designing",
  "Printing & Graphics",
  "Dealers / Distributors / Traders",
  "Other"
];

const SUB_INDUSTRIES = [
  "Software Development",
  "IT Consulting",
  "Cloud Services",
  "Data Analytics",
  "Cybersecurity",
  "E-commerce",
  "SaaS / Product",
  "Hardware Manufacturing",
  "Consumer Goods",
  "Industrial Equipment",
  "Food & Beverage",
  "Healthcare Services",
  "Diagnostics / Medical Devices",
  "Insurance Services",
  "Lending / Credit",
  "Wealth Management",
  "EdTech",
  "HR / Recruitment",
  "Marketing / Advertising",
  "Legal Services",
  "Accounting / Audit",
  "Real Estate Development",
  "Infrastructure / EPC",
  "Logistics / Supply Chain",
  "Other"
];

export function EnhancedCallDialog({ open, onOpenChange, demandcomData, onCallInitiated }: EnhancedCallDialogProps) {
  const [formData, setFormData] = useState<DemandComData>(demandcomData);
  const [dispositions, setDispositions] = useState<CallDisposition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userPhoneLoading, setUserPhoneLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(demandcomData);
      fetchDispositions();
      fetchUserPhone();
    }
  }, [open, demandcomData]);

  const fetchUserPhone = async () => {
    setUserPhoneLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .single();

      if (!error && profile?.phone) {
        setUserPhone(profile.phone);
      } else {
        setUserPhone(null);
      }
    } catch (error) {
      console.error("Error fetching user phone:", error);
      setUserPhone(null);
    } finally {
      setUserPhoneLoading(false);
    }
  };

  const fetchDispositions = async () => {
    const { data, error } = await supabase
      .from("call_dispositions")
      .select("*")
      .eq("is_active", true)
      .order("disposition");

    if (!error && data) {
      setDispositions(data);
    }
  };

  const handleFieldChange = (field: keyof DemandComData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validatePhoneNumber = (phone: string) => {
    return /^[\d\s\+\-\(\)]+$/.test(phone);
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    if (!formData.name?.trim() || !formData.mobile_numb?.trim()) return false;
    if (!validatePhoneNumber(formData.mobile_numb)) return false;
    if (formData.official && !validateEmail(formData.official)) return false;
    if (formData.personal_email_id && !validateEmail(formData.personal_email_id)) return false;
    return true;
  };

  const getEditedFields = () => {
    const edited: Record<string, any> = {};
    Object.keys(formData).forEach(key => {
      const fieldKey = key as keyof DemandComData;
      if (formData[fieldKey] !== demandcomData[fieldKey]) {
        edited[key] = formData[fieldKey];
      }
    });
    return edited;
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      setIsLoading(true);

      const editedFields = getEditedFields();
      
      if (Object.keys(editedFields).length === 0) {
        toast.error("No changes to save");
        return;
      }

      const { error: updateError } = await supabase
        .from("demandcom")
        .update(editedFields)
        .eq("id", demandcomData.id);

      if (updateError) throw updateError;

      const fieldCount = Object.keys(editedFields).length;
      toast.success(`Successfully updated ${fieldCount} field${fieldCount > 1 ? 's' : ''}`);
      
      onCallInitiated?.();
      onOpenChange(false);
      
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallNow = async () => {
    if (!formData.mobile_numb) {
      toast.error("No phone number available for participant");
      return;
    }

    if (!userPhone) {
      toast.error("Your phone number is not configured. Please update your profile with a valid phone number.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("You must be logged in to make calls");
        return;
      }

      console.log("Initiating call:", {
        from_number: userPhone,
        to_number: formData.mobile_numb,
        demandcom_id: formData.id
      });

      const { data, error } = await supabase.functions.invoke('exotel-make-call', {
        body: {
          from_number: userPhone, // User's phone - will be called first
          to_number: formData.mobile_numb, // Participant's phone - will be called second
          demandcom_id: formData.id,
          edited_contact_info: getEditedFields(),
          disposition: formData.latest_disposition || null,
          subdisposition: formData.latest_subdisposition || null,
          next_call_date: formData.next_call_date || null,
        },
      });

      if (error) {
        console.error("Call error:", error);
        toast.error("Failed to initiate call. Please try again.");
        return;
      }

      if (data && !data.success) {
        console.error("Exotel error:", data.error);
        toast.error(data.error || "Failed to initiate call");
        return;
      }

      toast.success(data?.message || "Call initiated! You will receive a call shortly.");
      
      // Call the onCallInitiated callback if provided
      if (onCallInitiated) {
        onCallInitiated();
      }
      
      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error("Error initiating call:", error);
      toast.error("Failed to initiate call");
    } finally {
      setIsLoading(false);
    }
  };

  const canMakeCall = !!userPhone && !!formData.mobile_numb && !userPhoneLoading;

  const availableSubdispositions = dispositions.find(d => d.disposition === formData.latest_disposition)?.subdispositions || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact - {demandcomData.name}</DialogTitle>
          <DialogDescription>
            Update any contact information and save changes
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="additional">Additional</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salutation">Salutation</Label>
                <Input
                  id="salutation"
                  value={formData.salutation || ""}
                  onChange={(e) => handleFieldChange("salutation", e.target.value)}
                  placeholder="Mr., Mrs., Dr., etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile_numb">Mobile Number *</Label>
                <Input
                  id="mobile_numb"
                  value={formData.mobile_numb}
                  onChange={(e) => handleFieldChange("mobile_numb", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name || ""}
                  onChange={(e) => handleFieldChange("company_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latest_disposition">Disposition</Label>
                <Select
                  value={formData.latest_disposition || ""}
                  onValueChange={(value) => {
                    handleFieldChange("latest_disposition", value);
                    handleFieldChange("latest_subdisposition", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {dispositions.map((disp) => (
                      <SelectItem key={disp.disposition} value={disp.disposition}>
                        {disp.disposition}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="latest_subdisposition">Sub-disposition</Label>
                <Select
                  value={formData.latest_subdisposition || ""}
                  onValueChange={(value) => handleFieldChange("latest_subdisposition", value)}
                  disabled={!formData.latest_disposition || availableSubdispositions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubdispositions.map((subdisp) => (
                      <SelectItem key={subdisp} value={subdisp}>
                        {subdisp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_call_date">Next Call Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.next_call_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.next_call_date ? format(new Date(formData.next_call_date), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.next_call_date ? new Date(formData.next_call_date) : undefined}
                      onSelect={(date) => handleFieldChange("next_call_date", date?.toISOString() || "")}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="official">Official Email</Label>
                <Input
                  id="official"
                  type="email"
                  value={formData.official || ""}
                  onChange={(e) => handleFieldChange("official", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personal_email_id">Personal Email</Label>
                <Input
                  id="personal_email_id"
                  type="email"
                  value={formData.personal_email_id || ""}
                  onChange={(e) => handleFieldChange("personal_email_id", e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={formData.linkedin || ""}
                  onChange={(e) => handleFieldChange("linkedin", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="professional" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={formData.designation || ""}
                  onChange={(e) => handleFieldChange("designation", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deppt">Department</Label>
                <Input
                  id="deppt"
                  value={formData.deppt || ""}
                  onChange={(e) => handleFieldChange("deppt", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_level_updated">Job Level</Label>
                <Input
                  id="job_level_updated"
                  value={formData.job_level_updated || ""}
                  onChange={(e) => handleFieldChange("job_level_updated", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name || ""}
                  onChange={(e) => handleFieldChange("company_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry_type">Industry Type</Label>
                <Select
                  value={formData.industry_type || ""}
                  onValueChange={(value) => handleFieldChange("industry_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub_industry">Sub Industry</Label>
                <Select
                  value={formData.sub_industry || ""}
                  onValueChange={(value) => handleFieldChange("sub_industry", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUB_INDUSTRIES.map((sub) => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_linkedin_url">Company LinkedIn URL</Label>
                <Input
                  id="company_linkedin_url"
                  value={formData.company_linkedin_url || ""}
                  onChange={(e) => handleFieldChange("company_linkedin_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="associated_member_linkedin">Associated Member LinkedIn</Label>
                <Input
                  id="associated_member_linkedin"
                  value={formData.associated_member_linkedin || ""}
                  onChange={(e) => handleFieldChange("associated_member_linkedin", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="location" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ""}
                  onChange={(e) => handleFieldChange("location", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city || ""}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state || ""}
                  onChange={(e) => handleFieldChange("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone">Zone</Label>
                <Input
                  id="zone"
                  value={formData.zone || ""}
                  onChange={(e) => handleFieldChange("zone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <Input
                  id="tier"
                  value={formData.tier || ""}
                  onChange={(e) => handleFieldChange("tier", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode || ""}
                  onChange={(e) => handleFieldChange("pincode", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country || ""}
                  onChange={(e) => handleFieldChange("country", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="company" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website || ""}
                  onChange={(e) => handleFieldChange("website", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="turnover">Turnover</Label>
                <Select
                  value={formData.turnover || ""}
                  onValueChange={(value) => handleFieldChange("turnover", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select turnover range" />
                  </SelectTrigger>
                  <SelectContent>
                    {TURNOVER_RANGES.map((range) => (
                      <SelectItem key={range} value={range}>{range}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp_size">Employee Size</Label>
                <Select
                  value={formData.emp_size || ""}
                  onValueChange={(value) => handleFieldChange("emp_size", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee size" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_SIZE_RANGES.map((range) => (
                      <SelectItem key={range} value={range}>{range}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="erp_name">ERP Name</Label>
                <Input
                  id="erp_name"
                  value={formData.erp_name || ""}
                  onChange={(e) => handleFieldChange("erp_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="erp_vendor">ERP Vendor</Label>
                <Input
                  id="erp_vendor"
                  value={formData.erp_vendor || ""}
                  onChange={(e) => handleFieldChange("erp_vendor", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="turnover_link">Turnover Link</Label>
                <Input
                  id="turnover_link"
                  value={formData.turnover_link || ""}
                  onChange={(e) => handleFieldChange("turnover_link", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="head_office_location">Head Office Location</Label>
                <Input
                  id="head_office_location"
                  value={formData.head_office_location || ""}
                  onChange={(e) => handleFieldChange("head_office_location", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="additional" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks || ""}
                  onChange={(e) => handleFieldChange("remarks", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={formData.source || ""}
                  onChange={(e) => handleFieldChange("source", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_1">Source 1</Label>
                <Input
                  id="source_1"
                  value={formData.source_1 || ""}
                  onChange={(e) => handleFieldChange("source_1", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extra">Extra</Label>
                <Input
                  id="extra"
                  value={formData.extra || ""}
                  onChange={(e) => handleFieldChange("extra", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extra_1">Extra 1</Label>
                <Input
                  id="extra_1"
                  value={formData.extra_1 || ""}
                  onChange={(e) => handleFieldChange("extra_1", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extra_2">Extra 2</Label>
                <Input
                  id="extra_2"
                  value={formData.extra_2 || ""}
                  onChange={(e) => handleFieldChange("extra_2", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

        </Tabs>

        <DialogFooter className="flex-col gap-2">
          {/* Warning when user phone is not configured */}
          {!userPhoneLoading && !userPhone && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md w-full">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Your phone number is not configured. Please update your profile to make calls.</span>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-between w-full">
            {Object.keys(getEditedFields()).length > 0 && (
              <div className="text-sm text-muted-foreground sm:mr-auto">
                {Object.keys(getEditedFields()).length} field{Object.keys(getEditedFields()).length > 1 ? 's' : ''} edited
              </div>
            )}
            <div className="flex gap-2 ml-auto flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCallNow}
                disabled={!canMakeCall || isLoading}
                title={!userPhone ? "Configure your phone number in profile to make calls" : ""}
              >
                <Phone className="mr-2 h-4 w-4" />
                {userPhoneLoading ? "Loading..." : "Call Now"}
              </Button>
              {Object.keys(getEditedFields()).length > 0 && (
                <Button
                  type="button"
                  variant="default"
                  onClick={handleSave}
                  disabled={isLoading || !isFormValid()}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
