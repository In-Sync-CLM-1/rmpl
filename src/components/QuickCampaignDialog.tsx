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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, MessageSquare, Send, Loader2, Database, FileSpreadsheet, Users, CheckSquare } from "lucide-react";
import { toast } from "sonner";

const DEMANDCOM_FIELDS = [
  { tag: "name", label: "Full Name", category: "Personal" },
  { tag: "first_name", label: "First Name", category: "Personal" },
  { tag: "last_name", label: "Last Name", category: "Personal" },
  { tag: "email", label: "Email", category: "Personal" },
  { tag: "phone", label: "Phone", category: "Personal" },
  { tag: "mobile2", label: "Mobile 2", category: "Personal" },
  { tag: "official", label: "Official Phone", category: "Personal" },
  { tag: "linkedin", label: "LinkedIn", category: "Personal" },
  { tag: "designation", label: "Designation", category: "Professional" },
  { tag: "department", label: "Department", category: "Professional" },
  { tag: "job_level_updated", label: "Job Level", category: "Professional" },
  { tag: "company_name", label: "Company Name", category: "Company" },
  { tag: "industry", label: "Industry", category: "Company" },
  { tag: "sub_industry", label: "Sub Industry", category: "Company" },
  { tag: "turnover", label: "Turnover", category: "Company" },
  { tag: "emp_size", label: "Employee Size", category: "Company" },
  { tag: "erp_name", label: "ERP Name", category: "Company" },
  { tag: "erp_vendor", label: "ERP Vendor", category: "Company" },
  { tag: "website", label: "Website", category: "Company" },
  { tag: "activity_name", label: "Activity Name", category: "Company" },
  { tag: "address", label: "Address", category: "Location" },
  { tag: "location", label: "Location", category: "Location" },
  { tag: "city", label: "City", category: "Location" },
  { tag: "state", label: "State", category: "Location" },
  { tag: "zone", label: "Zone", category: "Location" },
  { tag: "tier", label: "Tier", category: "Location" },
  { tag: "pincode", label: "Pincode", category: "Location" },
  { tag: "latest_disposition", label: "Latest Disposition", category: "Engagement" },
  { tag: "latest_subdisposition", label: "Latest Sub-disposition", category: "Engagement" },
  { tag: "last_call_date", label: "Last Call Date", category: "Engagement" },
];
const CATEGORIES = ["Personal", "Professional", "Company", "Location", "Engagement"];

// Merge-tag → actual demandcom row field
const TAG_TO_ROW: Record<string, string> = {
  name: "name", first_name: "__first__", last_name: "__last__",
  email: "email", phone: "mobile_numb", mobile2: "mobile2",
  official: "official", linkedin: "linkedin",
  designation: "designation", department: "deppt",
  job_level_updated: "job_level_updated",
  company_name: "company_name", industry: "industry_type",
  sub_industry: "sub_industry", turnover: "turnover",
  emp_size: "emp_size", erp_name: "erp_name", erp_vendor: "erp_vendor",
  website: "website", activity_name: "activity_name",
  address: "address", location: "location", city: "city",
  state: "state", zone: "zone", tier: "tier", pincode: "pincode",
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

interface AppliedFilters {
  nameEmail: string;
  city: string;
  activityName: string;
  assignedTo: string;
  disposition: string[];
  subdisposition: string[];
}

interface QuickCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedParticipants: any[]; // checkbox-selected rows
  appliedFilters: AppliedFilters;
  totalFilteredCount: number;
  currentPageCount: number;
}

export function QuickCampaignDialog({
  open,
  onOpenChange,
  selectedParticipants,
  appliedFilters,
  totalFilteredCount,
  currentPageCount,
}: QuickCampaignDialogProps) {
  const hasSelection = selectedParticipants.length > 0;
  const hasFilters = !!(appliedFilters.nameEmail || appliedFilters.city || appliedFilters.activityName ||
    (appliedFilters.assignedTo && appliedFilters.assignedTo !== "all") ||
    appliedFilters.disposition.length > 0 || appliedFilters.subdisposition.length > 0);

  // Audience scope: "selected" or "all_filtered"
  const [scope, setScope] = useState<"selected" | "all_filtered">(hasSelection ? "selected" : "all_filtered");
  const [type, setType] = useState<"email" | "whatsapp">("email");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [isFetchingAll, setIsFetchingAll] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setScope(hasSelection ? "selected" : "all_filtered");
    setTemplateId("");
    setSubject("");
    setVariableMapping({});
    setCustomValues({});
    setCampaignName(`Quick ${type === "whatsapp" ? "WhatsApp" : "Email"} - ${new Date().toLocaleDateString()}`);
    fetchTemplates();
  }, [open]);

  // Refetch templates on channel change
  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setSubject("");
    setVariableMapping({});
    setCustomValues({});
    setCampaignName(`Quick ${type === "whatsapp" ? "WhatsApp" : "Email"} - ${new Date().toLocaleDateString()}`);
    fetchTemplates();
  }, [type]);

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
      toast.error("Failed to load templates");
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
    setCustomValues({});
  }, [templateId]);

  const customVars = templateVariables.filter(v => {
    const m = variableMapping[v];
    return !m || m === "__custom__";
  });

  const recipientCount = scope === "selected" ? selectedParticipants.length : totalFilteredCount;

  // Resolve a field value from a demandcom row
  function resolveValue(tagName: string, row: any): string {
    if (tagName === "first_name") return (row.name || "").split(" ")[0] || "";
    if (tagName === "last_name") return (row.name || "").split(" ").slice(1).join(" ") || "";
    const field = TAG_TO_ROW[tagName];
    if (field && row[field] != null) return String(row[field]);
    if (row[tagName] != null) return String(row[tagName]);
    return "";
  }

  // Enrich a single demandcom row into audience-ready data
  function enrichRow(dc: any): any {
    const row: any = {
      email: dc.personal_email_id || dc.generic_email_id || dc.email || "",
      phone: dc.mobile_numb || dc.phone || "",
    };
    for (const varName of templateVariables) {
      const mapping = variableMapping[varName];
      if (mapping && mapping !== "__custom__") {
        row[varName] = resolveValue(mapping, dc);
      } else {
        row[varName] = customValues[varName] || "";
      }
    }
    return { ...dc, ...row };
  }

  // Fetch ALL filtered records from DB (no pagination limit)
  async function fetchAllFiltered(): Promise<any[]> {
    setIsFetchingAll(true);
    try {
      const batchSize = 1000;
      let allRecords: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from("demandcom" as any).select("*");

        // Apply same filters as the main page
        if (appliedFilters.nameEmail) {
          const p = `%${appliedFilters.nameEmail}%`;
          query = query.or(`name.ilike.${p},personal_email_id.ilike.${p},generic_email_id.ilike.${p},mobile_numb.ilike.${p}`);
        }
        if (appliedFilters.city) {
          query = query.ilike("city", `%${appliedFilters.city}%`);
        }
        if (appliedFilters.activityName) {
          query = query.ilike("activity_name", `%${appliedFilters.activityName}%`);
        }
        if (appliedFilters.assignedTo && appliedFilters.assignedTo !== "all") {
          if (appliedFilters.assignedTo === "unassigned") {
            query = query.is("assigned_to", null);
          } else {
            query = query.eq("assigned_to", appliedFilters.assignedTo);
          }
        }
        if (appliedFilters.disposition.length > 0) {
          query = query.in("latest_disposition", appliedFilters.disposition);
        }
        if (appliedFilters.subdisposition.length > 0) {
          query = query.in("latest_subdisposition", appliedFilters.subdisposition);
        }

        query = query.order("created_at", { ascending: false }).range(offset, offset + batchSize - 1);

        const { data, error } = await query;
        if (error) throw error;

        const batch = (data || []) as any[];
        allRecords = allRecords.concat(batch);
        offset += batchSize;
        hasMore = batch.length === batchSize;
      }

      return allRecords;
    } finally {
      setIsFetchingAll(false);
    }
  }

  const handleSend = async () => {
    if (!templateId) {
      toast.error("Please select a template");
      return;
    }
    if (scope === "selected" && selectedParticipants.length === 0) {
      toast.error("No participants selected. Use checkboxes to select rows or choose 'All filtered records'.");
      return;
    }

    setIsSending(true);
    setSendingProgress(0);

    try {
      // Get participants based on scope
      let rawParticipants: any[];
      if (scope === "selected") {
        rawParticipants = selectedParticipants;
      } else {
        toast.info(`Fetching all ${totalFilteredCount} filtered records...`);
        rawParticipants = await fetchAllFiltered();
        toast.success(`Loaded ${rawParticipants.length} records`);
      }

      // Enrich all participants
      const enriched = rawParticipants.map(enrichRow);

      // Validate contact identifiers
      const contactField = type === "whatsapp" ? "phone" : "email";
      const withContact = enriched.filter(r => r[contactField]);
      if (withContact.length === 0) {
        toast.error(`No participants have a ${contactField}. Cannot send.`);
        setIsSending(false);
        return;
      }
      if (withContact.length < enriched.length) {
        toast.warning(`${enriched.length - withContact.length} participants without ${contactField} will be skipped.`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create campaign
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
            ? (campaign.sent_count / campaign.total_recipients) * 100 : 0;
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
              toast.error("Campaign failed. Check logs.");
            }
            onOpenChange(false);
          }
        }
      }, 1000);

      setTimeout(() => { clearInterval(pollInterval); setIsSending(false); }, 300000);
    } catch (err: any) {
      toast.error("Campaign failed: " + err.message);
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSending ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Quick Campaign
          </DialogTitle>
          <DialogDescription>
            Send Email or WhatsApp campaign to DemandCom contacts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Audience Scope */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Who to send to</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as "selected" | "all_filtered")}
              className="space-y-1"
              disabled={isSending}
            >
              {hasSelection && (
                <div className="flex items-center gap-2 p-2 border rounded-lg">
                  <RadioGroupItem value="selected" id="scope-selected" />
                  <Label htmlFor="scope-selected" className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                    <CheckSquare className="h-4 w-4 text-blue-500" />
                    Selected rows only
                    <Badge variant="secondary" className="ml-auto">{selectedParticipants.length}</Badge>
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 border rounded-lg">
                <RadioGroupItem value="all_filtered" id="scope-all" />
                <Label htmlFor="scope-all" className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                  <Users className="h-4 w-4 text-green-500" />
                  All filtered records (all pages)
                  <Badge variant="secondary" className="ml-auto">{totalFilteredCount.toLocaleString()}</Badge>
                </Label>
              </div>
            </RadioGroup>
            {scope === "all_filtered" && hasFilters && (
              <div className="flex flex-wrap gap-1 mt-1">
                {appliedFilters.nameEmail && <Badge variant="outline" className="text-[10px]">Search: {appliedFilters.nameEmail}</Badge>}
                {appliedFilters.city && <Badge variant="outline" className="text-[10px]">City: {appliedFilters.city}</Badge>}
                {appliedFilters.activityName && <Badge variant="outline" className="text-[10px]">Activity: {appliedFilters.activityName}</Badge>}
                {appliedFilters.assignedTo && appliedFilters.assignedTo !== "all" && (
                  <Badge variant="outline" className="text-[10px]">Assigned: {appliedFilters.assignedTo === "unassigned" ? "Unassigned" : "Specific user"}</Badge>
                )}
                {appliedFilters.disposition.length > 0 && <Badge variant="outline" className="text-[10px]">Disposition: {appliedFilters.disposition.join(", ")}</Badge>}
                {appliedFilters.subdisposition.length > 0 && <Badge variant="outline" className="text-[10px]">Sub: {appliedFilters.subdisposition.join(", ")}</Badge>}
              </div>
            )}
            {scope === "all_filtered" && !hasFilters && (
              <p className="text-[10px] text-amber-600">No filters applied — this will send to ALL records in the database.</p>
            )}
          </div>

          {/* Campaign Name */}
          <div className="space-y-1">
            <Label className="text-xs">Campaign Name</Label>
            <Input
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="Campaign name"
              className="h-8 text-sm"
              disabled={isSending}
            />
          </div>

          {/* Channel */}
          <div className="space-y-1">
            <Label className="text-xs">Channel</Label>
            <div className="flex gap-2">
              <Button type="button" variant={type === "email" ? "default" : "outline"} onClick={() => setType("email")} className="flex-1 h-9" size="sm" disabled={isSending}>
                <Mail className="h-4 w-4 mr-1" /> Email
              </Button>
              <Button type="button" variant={type === "whatsapp" ? "default" : "outline"} onClick={() => setType("whatsapp")} className="flex-1 h-9" size="sm" disabled={isSending}>
                <MessageSquare className="h-4 w-4 mr-1" /> WhatsApp
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
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" className="h-8 text-sm" disabled={isSending} />
            </div>
          )}

          {/* Variable Mapping */}
          {templateId && templateVariables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Variable Mapping</Label>
              <div className="space-y-1.5">
                {templateVariables.map(varName => {
                  const cur = variableMapping[varName] || "__custom__";
                  const isMapped = cur !== "__custom__";
                  return (
                    <div key={varName} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] min-w-[90px] justify-center">{`{{${varName}}}`}</Badge>
                      <Select value={cur} onValueChange={val => setVariableMapping(prev => ({ ...prev, [varName]: val }))} disabled={isSending}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__custom__">
                            <span className="flex items-center gap-1 text-xs"><FileSpreadsheet className="h-3 w-3" /> Custom value</span>
                          </SelectItem>
                          {CATEGORIES.map(cat => (
                            <SelectGroup key={cat}>
                              <SelectLabel className="text-[10px]">{cat}</SelectLabel>
                              {DEMANDCOM_FIELDS.filter(f => f.category === cat).map(f => (
                                <SelectItem key={f.tag} value={f.tag}>
                                  <span className="flex items-center gap-1 text-xs"><Database className="h-3 w-3" /> {f.label}</span>
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
              <Label className="text-xs font-semibold">Custom Variable Values</Label>
              <p className="text-[10px] text-muted-foreground">Same value for all {recipientCount.toLocaleString()} recipients.</p>
              <div className="space-y-1.5">
                {customVars.map(varName => (
                  <div key={varName} className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px] min-w-[90px] justify-center">{`{{${varName}}}`}</Badge>
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

          {/* Progress */}
          {(isSending || isFetchingAll) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{isFetchingAll ? "Fetching records..." : "Sending..."}</span>
                {!isFetchingAll && <span>{Math.round(sendingProgress)}%</span>}
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: isFetchingAll ? "100%" : `${sendingProgress}%` }} />
              </div>
            </div>
          )}

          {/* Send */}
          <Button onClick={handleSend} disabled={!templateId || isSending || isFetchingAll} className="w-full">
            {isSending || isFetchingAll ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isFetchingAll ? "Fetching..." : "Sending..."}</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Send to {recipientCount.toLocaleString()} Recipient{recipientCount !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
