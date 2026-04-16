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
import { Loader2, Send, FileText, MessageSquare, Users, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";

interface AppliedFilters {
  nameEmail: string;
  city: string;
  activityName: string;
  assignedTo: string;
  disposition: string[];
  subdisposition: string[];
}

interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Individual mode
  demandcomId?: string;
  contactName?: string;
  phoneNumber?: string;
  onMessageSent?: () => void;
  // Bulk mode
  isBulk?: boolean;
  appliedFilters?: AppliedFilters;
  totalCount?: number;
}

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  demandcomId,
  contactName,
  phoneNumber,
  onMessageSent,
  isBulk = false,
  appliedFilters,
  totalCount = 0,
}: SendWhatsAppDialogProps) {
  const [messageType, setMessageType] = useState<"template" | "text">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [customMessage, setCustomMessage] = useState("");
  const [isBulkSending, setIsBulkSending] = useState(false);

  const { templates, isLoading: templatesLoading } = useWhatsAppTemplates(true);
  const { sendMessage, isSending: isIndividualSending } = useWhatsAppMessages(
    isBulk ? undefined : demandcomId,
    isBulk ? undefined : phoneNumber
  );

  const isSending = isBulk ? isBulkSending : isIndividualSending;
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Check if all variables have field mappings (enables auto-personalization)
  const hasFieldMappings =
    !!selectedTemplate &&
    selectedTemplate.variables.length > 0 &&
    selectedTemplate.variables.every((v) => v.field_name);

  const hasAnyVariables = !!selectedTemplate && selectedTemplate.variables.length > 0;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMessageType("template");
      setSelectedTemplateId("");
      setTemplateVariables({});
      setCustomMessage("");
    }
  }, [open]);

  // Populate variable keys when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const vars: Record<string, string> = {};
      selectedTemplate.variables.forEach((v) => {
        vars[String(v.index)] = "";
      });
      setTemplateVariables(vars);
    }
  }, [selectedTemplate]);

  const getPreviewContent = () => {
    if (!selectedTemplate) return "";
    let preview = selectedTemplate.content;
    if (isBulk && hasFieldMappings) {
      // Show field names in brackets instead of raw {{N}}
      selectedTemplate.variables.forEach((v) => {
        const label = v.field_name?.replace(/_/g, " ") || `{{${v.index}}}`;
        preview = preview.replace(`{{${v.index}}}`, `[${label}]`);
      });
    } else {
      // Replace with entered static values
      Object.entries(templateVariables).forEach(([key, value]) => {
        preview = preview.replace(`{{${key}}}`, value || `{{${key}}}`);
      });
    }
    return preview;
  };

  const handleSend = async () => {
    if (isBulk) {
      await handleBulkSend();
    } else {
      handleIndividualSend();
    }
  };

  const handleIndividualSend = () => {
    if (!phoneNumber) return;
    if (messageType === "template" && selectedTemplateId) {
      const bodyParams = Object.values(templateVariables).map((value) => ({
        type: "text" as const,
        text: value,
      }));
      sendMessage(
        {
          phoneNumber,
          demandcomId,
          templateId: selectedTemplateId,
          templateVariables,
          templateComponents:
            bodyParams.length > 0
              ? [{ type: "body", parameters: bodyParams }]
              : undefined,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            onMessageSent?.();
          },
        }
      );
    } else if (messageType === "text" && customMessage.trim()) {
      sendMessage(
        { phoneNumber, demandcomId, message: customMessage.trim() },
        {
          onSuccess: () => {
            onOpenChange(false);
            onMessageSent?.();
          },
        }
      );
    }
  };

  const handleBulkSend = async () => {
    setIsBulkSending(true);
    try {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new Error("Your session has expired — please log in again");
      }

      const payload: Record<string, unknown> = {
        mode: "bulk",
        filters: appliedFilters,
        templateId: messageType === "template" ? selectedTemplateId : undefined,
        templateVariables:
          messageType === "template" && hasAnyVariables && !hasFieldMappings
            ? templateVariables
            : undefined,
        message: messageType === "text" ? customMessage.trim() : undefined,
      };

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-bulk-whatsapp`, {
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

      const data = await response.json();

      const { sent, skipped, failed } = data as { sent: number; skipped: number; failed: number };
      toast.success(
        `Sent ${sent} message${sent !== 1 ? "s" : ""}` +
        (skipped > 0 ? `, ${skipped} skipped (no mobile)` : "") +
        (failed > 0 ? `, ${failed} failed` : "")
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send messages");
    } finally {
      setIsBulkSending(false);
    }
  };

  const canSend =
    (messageType === "template" && !!selectedTemplateId) ||
    (messageType === "text" && customMessage.trim().length > 0);

  const sendLabel = isBulk ? `Send to ~${totalCount} contacts` : "Send Message";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Send WhatsApp Message
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {isBulk ? (
              <>
                <Users className="h-4 w-4" />
                To: <strong>{totalCount}</strong> filtered contacts (those with mobile numbers will receive it)
              </>
            ) : (
              contactName ? `To: ${contactName} (${phoneNumber})` : `To: ${phoneNumber}`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <Tabs value={messageType} onValueChange={(v) => setMessageType(v as "template" | "text")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Template
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Custom Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder={templatesLoading ? "Loading..." : "Choose a template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.template_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk: auto-personalization status */}
              {isBulk && selectedTemplate && hasAnyVariables && (
                <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${hasFieldMappings ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {hasFieldMappings ? (
                    <>
                      <Sparkles className="h-4 w-4 shrink-0" />
                      Auto-personalized — each contact's details will be filled in automatically.
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      This template has variables with no field mappings. Values entered below will be sent identically to all contacts.
                    </>
                  )}
                </div>
              )}

              {/* Variable inputs — shown for individual always, for bulk only when no field mappings */}
              {selectedTemplate && hasAnyVariables && (!isBulk || !hasFieldMappings) && (
                <div className="space-y-3">
                  <Label>Template Variables</Label>
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable.index} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Variable {variable.index} ({variable.placeholder})
                        {variable.field_name && (
                          <span className="ml-2 text-green-600">→ {variable.field_name.replace(/_/g, " ")}</span>
                        )}
                      </Label>
                      <Input
                        value={templateVariables[String(variable.index)] || ""}
                        onChange={(e) =>
                          setTemplateVariables((prev) => ({
                            ...prev,
                            [String(variable.index)]: e.target.value,
                          }))
                        }
                        placeholder={`Enter value for ${variable.placeholder}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {selectedTemplate && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap break-words overflow-hidden">
                    {getPreviewContent()}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {isBulk
                    ? "This message will be sent as-is to all contacts. Custom text requires a 24-hour conversation window with each recipient."
                    : "Custom text messages require a 24-hour conversation window with the recipient."}
                </p>
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
