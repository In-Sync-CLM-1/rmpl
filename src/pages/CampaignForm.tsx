import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Calendar, Save, MessageSquare, Mail } from "lucide-react";
import { logError, getCurrentUserId, getSupabaseErrorMessage } from "@/lib/errorLogger";
import { CsvAudienceUpload } from "@/components/CsvAudienceUpload";

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
  
  // Check if we have preselected participants from navigation state
  const preselectedParticipants = location.state?.preselectedParticipants;

  useEffect(() => {
    fetchTemplates(type);
    if (id) {
      fetchCampaign();
    } else if (preselectedParticipants && preselectedParticipants.length > 0) {
      // Debug logging for preselected participants
      console.log('=== PRESELECTED PARTICIPANTS DEBUG ===');
      console.log('Count:', preselectedParticipants.length);
      console.log('Sample record:', preselectedParticipants[0]);
      console.log('Available fields:', Object.keys(preselectedParticipants[0] || {}));
      
      // If we have preselected participants, populate the audience data
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
  let mergeTags = selectedTemplate?.merge_tags || [];

  // Extract merge tags from template if not stored
  if (mergeTags.length === 0 && selectedTemplate) {
    const tagPattern = /\{\{[a-zA-Z_]+\}\}/g;
    const extractedTags: string[] = [];
    
    if (selectedTemplate.body_html) {
      const bodyTags = selectedTemplate.body_html.match(tagPattern) || [];
      extractedTags.push(...bodyTags);
    }
    if (subject) {
      const subjectTags = subject.match(tagPattern) || [];
      extractedTags.push(...subjectTags);
    }
    
    // Make unique
    mergeTags = [...new Set(extractedTags)];
  }

  const validateAudienceData = (data: any[], mergeTags: string[]) => {
    const missingFields: string[] = [];
    const requiredFields = mergeTags.map(tag => 
      tag.replace(/[{}]/g, '').trim()
    );
    
    // Check if any recipient is missing data for required fields
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
        description: "Please upload an audience CSV file",
        variant: "destructive",
      });
      return;
    }

    // Validate audience data against merge tags
    if (audienceData.length > 0 && mergeTags.length > 0) {
      const missingFields = validateAudienceData(audienceData, mergeTags);
      if (missingFields.length > 0) {
        console.warn('Some recipients have missing data:', missingFields);
        toast({
          title: "⚠️ Data Warning",
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
        console.log('Triggering campaign processing for campaign:', campaignId);
        
        // Trigger campaign processing with retry logic
        let processResult: any = null;
        let processError: any = null;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`Campaign processing attempt ${attempt}/${maxRetries}`);
          
          const { data, error } = await supabase.functions.invoke(
            'process-campaign',
            { body: { campaign_id: campaignId } }
          );
          
          processResult = data;
          processError = error;
          
          if (!error) {
            console.log('Campaign processing successful:', data);
            break;
          }
          
          console.error(`Campaign processing attempt ${attempt} failed:`, {
            error: error.message,
            context: error.context,
            status: error.status,
          });
          
          // Don't retry if it's a validation error (4xx)
          if (error.status && error.status >= 400 && error.status < 500) {
            break;
          }
          
          // Wait before retrying (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        if (processError) {
          console.error('Campaign processing failed after retries:', processError);
          throw new Error(
            processError.message ||
            (type === "whatsapp"
              ? 'Failed to process campaign. Please check your WhatsApp/Exotel settings.'
              : 'Failed to process campaign. Please check your RESEND_API_KEY configuration and verify your domain at resend.com/domains.')
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

            if (campaign.status === "sent") {
              clearInterval(pollInterval);
              setIsSending(false);
              
              const resultMessage = processResult?.message || `Campaign sent to ${campaign.sent_count} recipients`;
              const skippedCount = processResult?.skipped_count || 0;
              
              toast({
                title: "Campaign Sent",
                description: skippedCount > 0 
                  ? `${campaign.sent_count} sent, ${skippedCount} skipped (spam protection or unsubscribed)`
                  : resultMessage,
              });
              navigate("/campaigns");
            }
          }
        }, 1000);

        // Cleanup after 5 minutes
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
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

              <Button onClick={() => setCurrentTab("audience")}>
                Next: Select Audience
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audience Upload</CardTitle>
              <CardDescription>
                Upload a CSV file with your audience data (Recipients: {recipientCount})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CsvAudienceUpload
                mergeTags={mergeTags}
                onDataLoaded={setAudienceData}
                existingData={audienceData}
                disabled={!!preselectedParticipants && audienceData.length > 0}
              />

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setCurrentTab("details")}>
                  Back
                </Button>
                <Button onClick={() => setCurrentTab("preview")} disabled={audienceData.length === 0}>
                  Next: Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview & Review</CardTitle>
              <CardDescription>
                Review your campaign before sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Type:</strong> {type === "whatsapp" ? "WhatsApp" : "Email"}</p>
                <p><strong>Recipients:</strong> {recipientCount}</p>
                {type === "email" && <p><strong>Subject:</strong> {subject}</p>}
                {type === "whatsapp" && selectedTemplate && (
                  <p><strong>Template:</strong> {selectedTemplate.name}</p>
                )}
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setCurrentTab("audience")}>
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
              <CardDescription>
                Choose when to send your campaign
              </CardDescription>
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
