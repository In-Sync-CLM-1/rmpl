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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, FileText, Mail, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// datetime-local <-> Date helpers (browser interprets the input as local time)
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  const [freeformBodyHtml, setFreeformBodyHtml] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [scheduledForLocal, setScheduledForLocal] = useState("");

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    if (open) {
      setMessageType("template");
      setSelectedTemplateId("");
      setFreeformSubject("");
      setFreeformBodyHtml("");
      setSendMode("now");
      // Default scheduled time = 1 hour from now (local)
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
      setScheduledForLocal(toLocalInputValue(inOneHour));
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

  const hasRecipientEmail = isBulk || !!contactEmail;

  const freeformBodyText = freeformBodyHtml.replace(/<[^>]*>/g, "").trim();

  const scheduledDate = scheduledForLocal ? new Date(scheduledForLocal) : null;
  const scheduledIsValid =
    !!scheduledDate &&
    !Number.isNaN(scheduledDate.getTime()) &&
    scheduledDate.getTime() > Date.now();
  const scheduleOk = sendMode === "now" || scheduledIsValid;

  const canSend =
    hasRecipientEmail &&
    scheduleOk &&
    ((messageType === "template" && selectedTemplateId) ||
      (messageType === "freeform" && freeformSubject.trim() && freeformBodyText));

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      // Force a session refresh so we don't pass an expired access_token to the function
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new Error("Your session has expired — please log in again");
      }

      const payload: Record<string, unknown> = {
        mode: isBulk ? "bulk" : "individual",
        templateId: messageType === "template" ? selectedTemplateId : undefined,
        subject: messageType === "freeform" ? freeformSubject.trim() : undefined,
        bodyHtml: messageType === "freeform" ? freeformBodyHtml : undefined,
      };

      if (isBulk) {
        payload.filters = appliedFilters;
      } else {
        payload.demandcomId = demandcomId;
      }

      if (sendMode === "later" && scheduledDate) {
        payload.scheduledFor = scheduledDate.toISOString();
      }

      // Use direct fetch so we have full control over all headers
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-bulk-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${refreshed.session.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let serverMessage: string | undefined;
        try { serverMessage = (await response.json())?.error; } catch { /* ignore */ }
        throw new Error(serverMessage || `Request failed: ${response.status}`);
      }

      const result = (await response.json()) as {
        sent?: number;
        skipped?: number;
        failed?: number;
        scheduled?: boolean;
        scheduled_for?: string;
      };

      if (result.scheduled && result.scheduled_for) {
        const when = new Date(result.scheduled_for).toLocaleString();
        toast.success(
          isBulk
            ? `Scheduled to send to ~${totalCount} contacts on ${when}`
            : `Email scheduled for ${when}`
        );
      } else {
        const sent = result.sent ?? 0;
        const skipped = result.skipped ?? 0;
        const failed = result.failed ?? 0;
        if (isBulk) {
          toast.success(
            `Sent ${sent} email${sent !== 1 ? "s" : ""}` +
            (skipped > 0 ? `, ${skipped} skipped (no email)` : "") +
            (failed > 0 ? `, ${failed} failed` : "")
          );
        } else {
          if (failed > 0) {
            toast.error("Email send failed — check Edge Function logs");
          } else if (sent > 0) {
            toast.success("Email sent successfully");
          } else {
            toast.error("Email not sent — recipient has no email on record");
          }
        }
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const sendLabel = sendMode === "later"
    ? (isBulk ? `Schedule for ~${totalCount} contacts` : "Schedule Email")
    : (isBulk ? `Send to ~${totalCount} contacts` : "Send Email");

  const minScheduledLocal = toLocalInputValue(new Date(Date.now() + 60 * 1000));

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
                <RichTextEditor
                  value={freeformBodyHtml}
                  onChange={setFreeformBodyHtml}
                  placeholder="Type your message here..."
                  minHeight={200}
                />
                {isBulk && (
                  <p className="text-xs text-muted-foreground">
                    Tip: Use merge tags like <code>{"{{name}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{designation}}"}</code> for personalization.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t space-y-3">
            <Label className="text-sm font-medium">Delivery</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={sendMode === "now" ? "default" : "outline"}
                onClick={() => setSendMode("now")}
                className="flex items-center gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                Send Now
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sendMode === "later" ? "default" : "outline"}
                onClick={() => setSendMode("later")}
                className="flex items-center gap-2"
              >
                <Clock className="h-3.5 w-3.5" />
                Send Later
              </Button>
            </div>
            {sendMode === "later" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Scheduled time (your local timezone)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledForLocal}
                  min={minScheduledLocal}
                  onChange={(e) => setScheduledForLocal(e.target.value)}
                />
                {scheduledForLocal && !scheduledIsValid && (
                  <p className="text-xs text-destructive">Pick a future time.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  The email will be sent automatically within ~1 minute of this time.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend || isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {sendMode === "later" ? "Scheduling..." : "Sending..."}
              </>
            ) : (
              <>
                {sendMode === "later" ? (
                  <Clock className="h-4 w-4 mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {sendLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
