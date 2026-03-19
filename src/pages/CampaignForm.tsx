import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Calendar, Save, MessageSquare, Mail, Database, FileSpreadsheet } from "lucide-react";
import { logError, getCurrentUserId, getSupabaseErrorMessage } from "@/lib/errorLogger";
import { CsvAudienceUpload } from "@/components/CsvAudienceUpload";

// DemandCom fields available for variable mapping
// tag: the merge tag name used in templates
// field: the actual demandcom table column name
const DEMANDCOM_FIELDS = [
  { tag: "name", field: "name", label: "Full Name", category: "Personal" },
  { tag: "first_name", field: "name", label: "First Name (from name)", category: "Personal" },
  { tag: "last_name", field: "name", label: "Last Name (from name)", category: "Personal" },
  { tag: "email", field: "email", label: "Email", category: "Personal" },
  { tag: "phone", field: "mobile_numb", label: "Phone (mobile)", category: "Personal" },
  { tag: "mobile2", field: "mobile2", label: "Mobile 2", category: "Personal" },
  { tag: "official", field: "official", label: "Official Phone", category: "Personal" },
  { tag: "linkedin", field: "linkedin", label: "LinkedIn URL", category: "Personal" },
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

const DEMANDCOM_CATEGORIES = ["Personal", "Professional", "Company", "Location", "Engagement"];

interface Template {
  id: string;
  name: string;
  subject?: string;
  body_html?: string;
  body?: string;
  merge_tags?: string[];
}

export default function CampaignForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState("details");
  const [recipientCount, setRecipientCount] = useState(0);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"email" | "whatsapp">("email");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [audienceData, setAudienceData] = useState<any[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Variable mapping: variable name → demandcom field tag or "__custom__"
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});

  // Check if we have preselected participants from navigation state
  const preselectedParticipants = location.state?.preselectedParticipants;

  useEffect(() => {
    fetchTemplates(type);
    if (id) {
      fetchCampaign();
    } else if (preselectedParticipants && preselectedParticipants.length > 0) {
      setAudienceData(preselectedParticipants);
      toast({
        title: "Participants loaded",
        description: `${preselectedParticipants.length} participants added to campaign`,
      });
    }
  }, [id]);

  // Refetch templates when type changes
  useEffect(() => {
    setTemplateId("");
    setSubject("");
    setVariableMapping({});
    setAudienceData([]);
    fetchTemplates(type);
  }, [type]);

  useEffect(() => {
    setRecipientCount(audienceData.length);
  }, [audienceData]);

  const fetchTemplates = async (campaignType: "email" | "whatsapp") => {
    try {
      if (campaignType === "whatsapp") {
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
    } catch (error: any) {
      const userId = await getCurrentUserId(supabase);
      logError(error, {
        component: "CampaignForm",
        operation: "FETCH_DATA",
        userId,
        route: "/campaigns/new",
        metadata: { type: campaignType },
      });
    }
  };

  const fetchCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setName(data.name);
      if (data.type === "whatsapp") setType("whatsapp");
      setTemplateId(data.template_id || "");
      setSubject(data.subject || "");
      setAudienceData(Array.isArray(data.audience_data) ? data.audience_data : []);
      // Restore variable mapping from filter_criteria
      if (data.filter_criteria?.variable_mapping) {
        setVariableMapping(data.filter_criteria.variable_mapping);
      }
      if (data.scheduled_at) {
        const date = new Date(data.scheduled_at);
        setScheduledDate(date.toISOString().split("T")[0]);
        setScheduledTime(date.toTimeString().slice(0, 5));
      }
    } catch (error: any) {
      const userId = await getCurrentUserId(supabase);
      logError(error, {
        component: "CampaignForm",
        operation: "FETCH_DATA",
        userId,
        route: `/campaigns/${id}`,
        metadata: { campaignId: id },
      });
      toast({
        title: "Error",
        description: getSupabaseErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const selectedTemplate = templates.find(t => t.id === templateId);
  let templateVariables: string[] = []; // variable names without braces

  if (selectedTemplate) {
    // Get merge tags from template
    let rawTags = selectedTemplate.merge_tags || [];
    if (rawTags.length === 0) {
      const tagPattern = /\{\{[a-zA-Z_0-9]+\}\}/g;
      const extractedTags: string[] = [];
      if (selectedTemplate.body_html) {
        extractedTags.push(...(selectedTemplate.body_html.match(tagPattern) || []));
      }
      if (selectedTemplate.body) {
        extractedTags.push(...(selectedTemplate.body.match(tagPattern) || []));
      }
      if (subject) {
        extractedTags.push(...(subject.match(tagPattern) || []));
      }
      rawTags = [...new Set(extractedTags)];
    }
    templateVariables = rawTags.map(t => t.replace(/[{}]/g, ''));
  }

  // Auto-map variables when template changes
  useEffect(() => {
    if (templateVariables.length > 0 && Object.keys(variableMapping).length === 0) {
      const autoMap: Record<string, string> = {};
      for (const varName of templateVariables) {
        // Check if variable name matches any demandcom field tag
        const match = DEMANDCOM_FIELDS.find(f => f.tag === varName.toLowerCase());
        autoMap[varName] = match ? match.tag : "__custom__";
      }
      setVariableMapping(autoMap);
    }
  }, [templateId, templateVariables.length]);

  // Reset mapping when template changes
  useEffect(() => {
    setVariableMapping({});
    setAudienceData([]);
  }, [templateId]);

  // Compute which columns the CSV needs
  const customVariables = templateVariables.filter(v => {
    const mapping = variableMapping[v];
    return !mapping || mapping === "__custom__";
  });

  // CSV always needs the contact identifier + custom variable columns
  const contactIdField = type === "whatsapp" ? "phone" : "email";
  const csvRequiredColumns = [
    `{{${contactIdField}}}`,
    ...customVariables
      .filter(v => v.toLowerCase() !== contactIdField)
      .map(v => `{{${v}}}`),
  ];

  const hasMappedVariables = templateVariables.some(v => {
    const m = variableMapping[v];
    return m && m !== "__custom__";
  });

  const validateAudienceData = (data: any[], tags: string[]) => {
    const missingFields: string[] = [];
    const requiredFields = tags.map(tag => tag.replace(/[{}]/g, '').trim());

    requiredFields.forEach(field => {
      const recipientsWithMissingData = data.filter(row =>
        !row[field] || row[field] === ''
      );
      if (recipientsWithMissingData.length > 0) {
        missingFields.push(`${field} (${recipientsWithMissingData.length} recipients)`);
      }
    });

    return missingFields;
  };

  const handleSave = async (status: "draft" | "scheduled" | "sent") => {
    if (!name || !templateId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (audienceData.length === 0) {
      toast({
        title: "Error",
        description: "Please upload a contacts CSV file",
        variant: "destructive",
      });
      return;
    }

    // Validate audience data against CSV required columns
    if (audienceData.length > 0 && csvRequiredColumns.length > 0) {
      const missingFields = validateAudienceData(audienceData, csvRequiredColumns);
      if (missingFields.length > 0) {
        console.warn('Some recipients have missing data:', missingFields);
        toast({
          title: "Data Warning",
          description: `Some recipients are missing data for: ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? '...' : ''}. These fields will appear blank in messages.`,
        });
      }
    }

    try {
      setIsLoading(true);
      if (status === "sent") {
        setIsSending(true);
        setSendingProgress(0);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let scheduledAt = null;
      if (status === "scheduled" && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const campaignData = {
        name,
        type,
        template_id: templateId,
        subject,
        audience_data: audienceData,
        filter_criteria: { variable_mapping: variableMapping },
        status,
        scheduled_at: scheduledAt,
        total_recipients: recipientCount,
        created_by: user.id,
      };

      let campaignId = id;
      if (id) {
        const { error } = await supabase
          .from("campaigns")
          .update(campaignData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data: newCampaign, error } = await supabase
          .from("campaigns")
          .insert([campaignData])
          .select()
          .single();
        if (error) throw error;
        campaignId = newCampaign.id;
      }

      // If sending immediately, trigger the processing and monitor progress
      if (status === "sent" && campaignId) {
        let processResult: any = null;
        let processError: any = null;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const { data, error } = await supabase.functions.invoke(
            'process-campaign',
            { body: { campaign_id: campaignId } }
          );

          processResult = data;
          processError = error;

          if (!error) break;

          if (error.status && error.status >= 400 && error.status < 500) break;

          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        if (processError) {
          throw new Error(
            processError.message ||
            (type === "whatsapp"
              ? 'Failed to process campaign. Please check your WhatsApp/Exotel settings.'
              : 'Failed to process campaign. Please check your RESEND_API_KEY configuration.')
          );
        }

        // Poll for completion
        const pollInterval = setInterval(async () => {
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("sent_count, total_recipients, status")
            .eq("id", campaignId)
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
                const resultMessage = processResult?.message || `Campaign sent to ${campaign.sent_count} recipients`;
                const skippedCount = processResult?.skipped_count || 0;
                toast({
                  title: "Campaign Sent",
                  description: skippedCount > 0
                    ? `${campaign.sent_count} sent, ${skippedCount} skipped`
                    : resultMessage,
                });
              }
              navigate("/campaigns");
            }
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setIsSending(false);
        }, 300000);
      } else {
        toast({
          title: "Success",
          description: `Campaign ${id ? "updated" : "created"} successfully`,
        });
        navigate("/campaigns");
      }
    } catch (error: any) {
      const userId = await getCurrentUserId(supabase);
      logError(error, {
        component: "CampaignForm",
        operation: id ? "UPDATE_DATA" : "CREATE_DATA",
        userId,
        route: `/campaigns/${id || "new"}`,
        metadata: { name, type, status },
      });
      toast({
        title: "Error",
        description: getSupabaseErrorMessage(error),
        variant: "destructive",
      });
      setIsSending(false);
    } finally {
      if (status !== "sent") {
        setIsLoading(false);
      }
    }
  };

  const updateMapping = (varName: string, value: string) => {
    setVariableMapping(prev => ({ ...prev, [varName]: value }));
    // Clear audience data since CSV column requirements may have changed
    setAudienceData([]);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">
          {id ? "Edit Campaign" : "New Campaign"}
        </h1>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details & Contacts</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Configure your campaign settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Weekly Project Alerts"
                />
              </div>

              <div className="space-y-2">
                <Label>Channel *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={type === "email" ? "default" : "outline"}
                    onClick={() => setType("email")}
                    className="flex-1"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={type === "whatsapp" ? "default" : "outline"}
                    onClick={() => setType("whatsapp")}
                    className="flex-1"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">{type === "whatsapp" ? "WhatsApp Template" : "Email Template"} *</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "email" && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., New opportunities in your area"
                  />
                </div>
              )}

              {/* Variable Mapping */}
              {templateId && templateVariables.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-1">Variable Mapping</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    For each template variable, pick a DemandCom field (auto-filled) or keep as Custom (from CSV).
                  </p>
                  <div className="space-y-2">
                    {templateVariables.map(varName => {
                      const currentMapping = variableMapping[varName] || "__custom__";
                      const isMapped = currentMapping !== "__custom__";
                      return (
                        <div key={varName} className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs min-w-[100px] justify-center">
                            {`{{${varName}}}`}
                          </Badge>
                          <Select value={currentMapping} onValueChange={(val) => updateMapping(varName, val)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__custom__">
                                <span className="flex items-center gap-1">
                                  <FileSpreadsheet className="h-3 w-3" />
                                  Custom (from CSV column)
                                </span>
                              </SelectItem>
                              {DEMANDCOM_CATEGORIES.map(cat => (
                                <SelectGroup key={cat}>
                                  <SelectLabel>{cat}</SelectLabel>
                                  {DEMANDCOM_FIELDS.filter(f => f.category === cat).map(f => (
                                    <SelectItem key={f.tag} value={f.tag}>
                                      <span className="flex items-center gap-1">
                                        <Database className="h-3 w-3" />
                                        {f.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge variant={isMapped ? "default" : "secondary"} className="text-[10px] min-w-[50px] justify-center">
                            {isMapped ? "DB" : "CSV"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>

                  {hasMappedVariables && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      DB-mapped variables will be auto-filled from DemandCom data using the contact's {contactIdField}.
                    </p>
                  )}
                </div>
              )}

              {/* CSV Upload */}
              {templateId && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-1">Upload Contacts CSV</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    CSV must have a <strong>{contactIdField}</strong> column
                    {customVariables.length > 0 && (
                      <> and columns for: <strong>{customVariables.filter(v => v.toLowerCase() !== contactIdField).join(", ") || "none"}</strong></>
                    )}
                    .
                    {recipientCount > 0 && <span className="ml-1 text-primary font-medium">({recipientCount} contacts loaded)</span>}
                  </p>
                  <CsvAudienceUpload
                    mergeTags={csvRequiredColumns}
                    onDataLoaded={setAudienceData}
                    existingData={audienceData}
                    disabled={!!preselectedParticipants && audienceData.length > 0}
                  />
                </div>
              )}

              <Button onClick={() => setCurrentTab("preview")} disabled={audienceData.length === 0}>
                Next: Preview
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview & Review</CardTitle>
              <CardDescription>Review your campaign before sending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Channel:</strong> {type === "whatsapp" ? "WhatsApp" : "Email"}</p>
                <p><strong>Recipients:</strong> {recipientCount}</p>
                {type === "email" && <p><strong>Subject:</strong> {subject}</p>}
                {selectedTemplate && <p><strong>Template:</strong> {selectedTemplate.name}</p>}
              </div>

              {templateVariables.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Variable Sources:</p>
                  <div className="flex flex-wrap gap-1">
                    {templateVariables.map(v => {
                      const m = variableMapping[v];
                      const isMapped = m && m !== "__custom__";
                      const dcField = isMapped ? DEMANDCOM_FIELDS.find(f => f.tag === m) : null;
                      return (
                        <Badge key={v} variant={isMapped ? "default" : "secondary"} className="text-xs">
                          {`{{${v}}}`} → {isMapped ? `DB: ${dcField?.label || m}` : "CSV"}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setCurrentTab("details")}>
                  Back
                </Button>
                <Button onClick={() => setCurrentTab("schedule")}>
                  Next: Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Campaign</CardTitle>
              <CardDescription>Choose when to send your campaign</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>

              {isSending && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Sending campaign...</span>
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

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setCurrentTab("preview")}>
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSave("draft")}
                  disabled={isLoading || isSending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSave("scheduled")}
                  disabled={isLoading || isSending || !scheduledDate || !scheduledTime}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </Button>
                <Button onClick={() => handleSave("sent")} disabled={isLoading || isSending}>
                  <Send className="mr-2 h-4 w-4" />
                  {isSending ? "Sending..." : "Send Now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
