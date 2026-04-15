import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, FileText, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: string | null;
  is_active: boolean;
}

interface AppliedFilters {
  nameEmail: string;
  city: string;
  activityName: string;
  assignedTo: string;
  disposition: string[];
  subdisposition: string[];
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Individual mode
  demandcomId?: string;
  contactName?: string;
  contactEmail?: string;
  // Bulk mode
  isBulk?: boolean;
  appliedFilters?: AppliedFilters;
  totalCount?: number;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  demandcomId,
  contactName,
  contactEmail,
  isBulk = false,
  appliedFilters,
  totalCount = 0,
}: SendEmailDialogProps) {
  const [messageType, setMessageType] = useState<"template" | "freeform">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [freeformSubject, setFreeformSubject] = useState("");
  const [freeformBody, setFreeformBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    if (open) {
      setMessageType("template");
      setSelectedTemplateId("");
      setFreeformSubject("");
      setFreeformBody("");
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject, body_html, category, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setTemplates(data || []);
    } catch {
      toast.error("Failed to load email templates");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const canSend =
    (messageType === "template" && selectedTemplateId) ||
    (messageType === "freeform" && freeformSubject.trim() && freeformBody.trim());

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const payload: Record<string, unknown> = {
        mode: isBulk ? "bulk" : "individual",
        templateId: messageType === "template" ? selectedTemplateId : undefined,
        subject: messageType === "freeform" ? freeformSubject.trim() : undefined,
        bodyText: messageType === "freeform" ? freeformBody.trim() : undefined,
      };

      if (isBulk) {
        payload.filters = appliedFilters;
      } else {
        payload.demandcomId = demandcomId;
      }

      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const { sent, skipped, failed } = data as { sent: number; skipped: number; failed: number };
      if (isBulk) {
        toast.success(
          `Sent ${sent} email${sent !== 1 ? "s" : ""}` +
          (skipped > 0 ? `, ${skipped} skipped (no email)` : "") +
          (failed > 0 ? `, ${failed} failed` : "")
        );
      } else {
        toast.success("Email sent successfully");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const sendLabel = isBulk
    ? `Send to ~${totalCount} contacts`
    : "Send Email";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Send Email
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {isBulk ? (
              <>
                <Users className="h-4 w-4" />
                To: <strong>{totalCount}</strong> filtered contacts (those with email addresses will receive it)
              </>
            ) : (
              <>
                To: {contactName ? <strong>{contactName}</strong> : null}
                {contactEmail ? ` (${contactEmail})` : " — no email on record"}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <Tabs value={messageType} onValueChange={(v) => setMessageType(v as "template" | "freeform")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Template
              </TabsTrigger>
              <TabsTrigger value="freeform" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Freeform
              </TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder={templatesLoading ? "Loading..." : "Choose an email template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span>{t.name}</span>
                          {t.category && (
                            <Badge variant="outline" className="text-xs">
                              {t.category}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {!templatesLoading && templates.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No active email templates found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <div className="px-3 py-2 rounded-md border bg-muted/40 text-sm">
                      {selectedTemplate.subject}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Preview
                      {isBulk && (
                        <span className="ml-2 text-blue-500">
                          — merge tags will be personalized per recipient
                        </span>
                      )}
                    </Label>
                    <div
                      className="p-3 rounded-md border bg-muted/20 text-sm overflow-auto max-h-48 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedTemplate.body_html }}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="freeform" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={freeformSubject}
                  onChange={(e) => setFreeformSubject(e.target.value)}
                  placeholder="Enter email subject..."
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={freeformBody}
                  onChange={(e) => setFreeformBody(e.target.value)}
                  placeholder="Type your message here..."
                  rows={8}
                />
                {isBulk && (
                  <p className="text-xs text-muted-foreground">
                    Tip: Use merge tags like <code>{"{{name}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{designation}}"}</code> for personalization.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend || isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {sendLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
