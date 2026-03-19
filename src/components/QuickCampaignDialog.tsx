import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, MessageSquare, Send, Loader2, Database, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

// Same field mapping as CampaignForm / process-campaign
const DEMANDCOM_FIELDS = [
  { tag: "name", field: "name", label: "Full Name", category: "Personal" },
  { tag: "first_name", field: "name", label: "First Name", category: "Personal" },
  { tag: "last_name", field: "name", label: "Last Name", category: "Personal" },
  { tag: "email", field: "email", label: "Email", category: "Personal" },
  { tag: "phone", field: "mobile_numb", label: "Phone", category: "Personal" },
  { tag: "mobile2", field: "mobile2", label: "Mobile 2", category: "Personal" },
  { tag: "official", field: "official", label: "Official Phone", category: "Personal" },
  { tag: "linkedin", field: "linkedin", label: "LinkedIn", category: "Personal" },
  { tag: "designation", field: "designation", label: "Designation", category: "Professional" },
  { tag: "department", field: "deppt", label: "Department", category: "Professional" },
  { tag: "job_level_updated", field: "job_level_updated", label: "Job Level", category: "Professional" },
  { tag: "company_name", field: "company_name", label: "Company Name", category: "Company" },
  { tag: "industry", field: "industry_type", label: "Industry", category: "Company" },
  { tag: "sub_industry", field: "sub_industry", label: "Sub Industry", category: "Company" },
  { tag: "turnover", field: "turnover", label: "Turnover", category: "Company" },
  { tag: "emp_size", field: "emp_size", label: "Employee Size", category: "Company" },
  { tag: "erp_name", field: "erp_name", label: "ERP Name", category: "Company" },
  { tag: "erp_vendor", field: "erp_vendor", label: "ERP Vendor", category: "Company" },
  { tag: "website", field: "website", label: "Website", category: "Company" },
  { tag: "activity_name", field: "activity_name", label: "Activity Name", category: "Company" },
  { tag: "address", field: "address", label: "Address", category: "Location" },
  { tag: "location", field: "location", label: "Location", category: "Location" },
  { tag: "city", field: "city", label: "City", category: "Location" },
  { tag: "state", field: "state", label: "State", category: "Location" },
  { tag: "zone", field: "zone", label: "Zone", category: "Location" },
  { tag: "tier", field: "tier", label: "Tier", category: "Location" },
  { tag: "pincode", field: "pincode", label: "Pincode", category: "Location" },
  { tag: "latest_disposition", field: "latest_disposition", label: "Latest Disposition", category: "Engagement" },
  { tag: "latest_subdisposition", field: "latest_subdisposition", label: "Latest Sub-disposition", category: "Engagement" },
  { tag: "last_call_date", field: "last_call_date", label: "Last Call Date", category: "Engagement" },
];

const CATEGORIES = ["Personal", "Professional", "Company", "Location", "Engagement"];

// Map merge tag name → demandcom row field
const TAG_TO_ROW_FIELD: Record<string, string> = {
  name: "name",
  first_name: "__first_name__",
  last_name: "__last_name__",
  email: "email",
  phone: "mobile_numb",
  mobile2: "mobile2",
  official: "official",
  linkedin: "linkedin",
  designation: "designation",
  department: "deppt",
  job_level_updated: "job_level_updated",
  company_name: "company_name",
  industry: "industry_type",
  sub_industry: "sub_industry",
  turnover: "turnover",
  emp_size: "emp_size",
  erp_name: "erp_name",
  erp_vendor: "erp_vendor",
  website: "website",
  activity_name: "activity_name",
  address: "address",
  location: "location",
  city: "city",
  state: "state",
  zone: "zone",
  tier: "tier",
  pincode: "pincode",
  latest_disposition: "latest_disposition",
  latest_subdisposition: "latest_subdisposition",
  last_call_date: "last_call_date",
};

interface Template {
  id: string;
  name: string;
  subject?: string;
  body_html?: string;
  body?: string;
  merge_tags?: string[];
}

interface QuickCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: any[];
}

export function QuickCampaignDialog({ open, onOpenChange, participants }: QuickCampaignDialogProps) {
  const [type, setType] = useState<"email" | "whatsapp">("email");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);

  // Fetch templates when type changes
  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setSubject("");
    setVariableMapping({});
    setCampaignName(`Quick ${type === "whatsapp" ? "WhatsApp" : "Email"} - ${new Date().toLocaleDateString()}`);
    fetchTemplates();
  }, [type, open]);

  const fetchTemplates = async () => {
    try {
      if (type === "whatsapp") {
        const { data, error } = await supabase
          .from("whatsapp_templates")
          .select("id, template_name, content, variables")
          .eq("status", "approved");
        if (error) throw error;
        setTemplates((data || []).map((t: any) => ({
          id: t.id,
          name: t.template_name,
          body: t.content,
          merge_tags: (t.variables || []).map((v: any) => `{{${v.placeholder}}}`),
        })));
      } else {
        const { data, error } = await supabase
          .from("email_templates")
          .select("id, name, subject, body_html, merge_tags")
          .eq("is_active", true);
        if (error) throw error;
        setTemplates(data || []);
      }
    } catch (err: any) {
      toast.error("Failed to load templates: " + err.message);
    }
  };

  const selectedTemplate = templates.find(t => t.id === templateId);

  // Extract template variables
  let templateVariables: string[] = [];
  if (selectedTemplate) {
    let rawTags = selectedTemplate.merge_tags || [];
    if (rawTags.length === 0) {
      const tagPattern = /\{\{[a-zA-Z_0-9]+\}\}/g;
      const extracted: string[] = [];
      if (selectedTemplate.body_html) extracted.push(...(selectedTemplate.body_html.match(tagPattern) || []));
      if (selectedTemplate.body) extracted.push(...(selectedTemplate.body.match(tagPattern) || []));
      if (subject) extracted.push(...(subject.match(tagPattern) || []));
      rawTags = [...new Set(extracted)];
    }
    templateVariables = rawTags.map(t => t.replace(/[{}]/g, ''));
  }

  // Auto-map when template changes
  useEffect(() => {
    if (templateVariables.length > 0) {
      const autoMap: Record<string, string> = {};
      for (const v of templateVariables) {
        const match = DEMANDCOM_FIELDS.find(f => f.tag === v.toLowerCase());
        autoMap[v] = match ? match.tag : "__custom__";
      }
      setVariableMapping(autoMap);
    } else {
      setVariableMapping({});
    }
  }, [templateId]);

  // Custom variables that need user input
  const customVars = templateVariables.filter(v => {
    const m = variableMapping[v];
    return !m || m === "__custom__";
  });

  // Custom variable values (single value applied to all recipients)
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Reset custom values when template changes
  useEffect(() => {
    setCustomValues({});
  }, [templateId]);

  // Resolve a tag value from a demandcom row
  function resolveValue(tagName: string, row: any): string {
    if (tagName === "first_name") return (row.name || "").split(" ")[0] || "";
    if (tagName === "last_name") return (row.name || "").split(" ").slice(1).join(" ") || "";
    const field = TAG_TO_ROW_FIELD[tagName];
    if (field && row[field] !== undefined && row[field] !== null) return String(row[field]);
    // Fallback: try the tag name directly on the row
    if (row[tagName] !== undefined && row[tagName] !== null) return String(row[tagName]);
    return "";
  }

  // Build enriched audience data
  function buildAudienceData(): any[] {
    return participants.map(dc => {
      const row: any = {
        // Contact identifiers
        email: dc.personal_email_id || dc.generic_email_id || dc.email || "",
        phone: dc.mobile_numb || dc.phone || "",
      };

      // For each template variable, fill the value
      for (const varName of templateVariables) {
        const mapping = variableMapping[varName];
        if (mapping && mapping !== "__custom__") {
          // DB-mapped: resolve from the demandcom row
          row[varName] = resolveValue(mapping, dc);
        } else {
          // Custom: use the single custom value
          row[varName] = customValues[varName] || "";
        }
      }

      // Keep original fields for backward compat
      return { ...dc, ...row };
    });
  }

  const handleSend = async () => {
    if (!templateId) {
      toast.error("Please select a template");
      return;
    }

    // Validate contact identifiers
    const contactField = type === "whatsapp" ? "phone" : "email";
    const enriched = buildAudienceData();
    const missing = enriched.filter(r => !r[contactField]);
    if (missing.length === enriched.length) {
      toast.error(`No participants have a ${contactField}. Cannot send.`);
      return;
    }
    if (missing.length > 0) {
      toast.warning(`${missing.length} of ${enriched.length} participants have no ${contactField} and will be skipped.`);
    }

    setIsSending(true);
    setSendingProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create campaign record
      const { data: newCampaign, error: createError } = await supabase
        .from("campaigns")
        .insert([{
          name: campaignName || `Quick ${type} campaign`,
          type,
          template_id: templateId,
          subject: type === "email" ? subject : null,
          audience_data: enriched,
          filter_criteria: { variable_mapping: variableMapping },
          status: "sent",
          total_recipients: enriched.length,
          created_by: user.id,
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Trigger processing
      const { data: result, error: processError } = await supabase.functions.invoke(
        "process-campaign",
        { body: { campaign_id: newCampaign.id } }
      );

      if (processError) throw processError;

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("sent_count, total_recipients, status")
          .eq("id", newCampaign.id)
          .single();

        if (campaign) {
          const progress = campaign.total_recipients > 0
            ? (campaign.sent_count / campaign.total_recipients) * 100
            : 0;
          setSendingProgress(progress);

          if (campaign.status === "sent" || campaign.status === "failed") {
            clearInterval(pollInterval);
            setIsSending(false);
            if (campaign.status === "sent") {
              const skipped = result?.skipped_count || 0;
              toast.success(
                skipped > 0
                  ? `${campaign.sent_count} sent, ${skipped} skipped`
                  : `Campaign sent to ${campaign.sent_count} recipients`
              );
            } else {
              toast.error("Campaign failed. Check logs for details.");
            }
            onOpenChange(false);
          }
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setIsSending(false);
      }, 300000);
    } catch (err: any) {
      toast.error("Campaign failed: " + err.message);
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSending ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Campaign</DialogTitle>
          <DialogDescription>
            Send to {participants.length} selected participant{participants.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campaign Name */}
          <div className="space-y-1">
            <Label className="text-xs">Campaign Name</Label>
            <Input
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="Campaign name"
              className="h-8 text-sm"
            />
          </div>

          {/* Channel Selector */}
          <div className="space-y-1">
            <Label className="text-xs">Channel</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === "email" ? "default" : "outline"}
                onClick={() => setType("email")}
                className="flex-1 h-9"
                size="sm"
                disabled={isSending}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button
                type="button"
                variant={type === "whatsapp" ? "default" : "outline"}
                onClick={() => setType("whatsapp")}
                className="flex-1 h-9"
                size="sm"
                disabled={isSending}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Template */}
          <div className="space-y-1">
            <Label className="text-xs">{type === "whatsapp" ? "WhatsApp Template" : "Email Template"}</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={isSending}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject (email only) */}
          {type === "email" && templateId && (
            <div className="space-y-1">
              <Label className="text-xs">Subject Line</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject"
                className="h-8 text-sm"
                disabled={isSending}
              />
            </div>
          )}

          {/* Variable Mapping */}
          {templateId && templateVariables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Variable Mapping</Label>
              <div className="space-y-1.5">
                {templateVariables.map(varName => {
                  const currentMapping = variableMapping[varName] || "__custom__";
                  const isMapped = currentMapping !== "__custom__";
                  return (
                    <div key={varName} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] min-w-[90px] justify-center">
                        {`{{${varName}}}`}
                      </Badge>
                      <Select
                        value={currentMapping}
                        onValueChange={val => setVariableMapping(prev => ({ ...prev, [varName]: val }))}
                        disabled={isSending}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__custom__">
                            <span className="flex items-center gap-1 text-xs">
                              <FileSpreadsheet className="h-3 w-3" />
                              Custom value
                            </span>
                          </SelectItem>
                          {CATEGORIES.map(cat => (
                            <SelectGroup key={cat}>
                              <SelectLabel className="text-[10px]">{cat}</SelectLabel>
                              {DEMANDCOM_FIELDS.filter(f => f.category === cat).map(f => (
                                <SelectItem key={f.tag} value={f.tag}>
                                  <span className="flex items-center gap-1 text-xs">
                                    <Database className="h-3 w-3" />
                                    {f.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant={isMapped ? "default" : "secondary"} className="text-[10px] min-w-[36px] justify-center">
                        {isMapped ? "DB" : "Custom"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom variable inputs */}
          {customVars.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Custom Variable Values</Label>
              <p className="text-[10px] text-muted-foreground">
                These values will be the same for all {participants.length} recipients.
              </p>
              <div className="space-y-1.5">
                {customVars.map(varName => (
                  <div key={varName} className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px] min-w-[90px] justify-center">
                      {`{{${varName}}}`}
                    </Badge>
                    <Input
                      value={customValues[varName] || ""}
                      onChange={e => setCustomValues(prev => ({ ...prev, [varName]: e.target.value }))}
                      placeholder={`Value for ${varName}`}
                      className="h-8 text-xs flex-1"
                      disabled={isSending}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sending Progress */}
          {isSending && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Sending...</span>
                <span>{Math.round(sendingProgress)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${sendingProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Send */}
          <Button
            onClick={handleSend}
            disabled={!templateId || isSending || participants.length === 0}
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {participants.length} Recipient{participants.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
