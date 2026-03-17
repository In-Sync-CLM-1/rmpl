import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ButtonItem {
  type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "en_US", label: "English (US)" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" },
  { value: "gu", label: "Gujarati" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "pa", label: "Punjabi" },
];

const CATEGORIES = [
  { value: "UTILITY", label: "Utility", description: "Order updates, account alerts, etc." },
  { value: "MARKETING", label: "Marketing", description: "Promotions, offers, newsletters" },
  { value: "AUTHENTICATION", label: "Authentication", description: "OTP & verification codes" },
];

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("UTILITY");
  const [language, setLanguage] = useState("en");
  const [allowCategoryChange, setAllowCategoryChange] = useState(true);

  // Header
  const [hasHeader, setHasHeader] = useState(false);
  const [headerFormat, setHeaderFormat] = useState<"TEXT">("TEXT");
  const [headerText, setHeaderText] = useState("");
  const [headerExample, setHeaderExample] = useState("");

  // Body
  const [bodyText, setBodyText] = useState("");
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);

  // Footer
  const [hasFooter, setHasFooter] = useState(false);
  const [footerText, setFooterText] = useState("");

  // Buttons
  const [buttons, setButtons] = useState<ButtonItem[]>([]);

  // Extract variables from body text
  const bodyVariables = (bodyText.match(/\{\{(\d+)\}\}/g) || []).map((v) => v);
  const headerVariables = (headerText.match(/\{\{(\d+)\}\}/g) || []).map((v) => v);

  // Keep body examples in sync with variable count
  const syncBodyExamples = (text: string) => {
    setBodyText(text);
    const vars = (text.match(/\{\{(\d+)\}\}/g) || []);
    setBodyExamples((prev) => {
      const updated = [...prev];
      while (updated.length < vars.length) updated.push("");
      return updated.slice(0, vars.length);
    });
  };

  const resetForm = () => {
    setName("");
    setCategory("UTILITY");
    setLanguage("en");
    setAllowCategoryChange(true);
    setHasHeader(false);
    setHeaderFormat("TEXT");
    setHeaderText("");
    setHeaderExample("");
    setBodyText("");
    setBodyExamples([]);
    setHasFooter(false);
    setFooterText("");
    setButtons([]);
  };

  const addButton = () => {
    if (buttons.length >= 3) {
      toast.error("Maximum 3 buttons allowed.");
      return;
    }
    setButtons([...buttons, { type: "URL", text: "", url: "" }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: keyof ButtonItem, value: string) => {
    const updated = [...buttons];
    (updated[index] as any)[field] = value;
    setButtons(updated);
  };

  const displayName = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  const canSubmit =
    name.trim() &&
    category &&
    language &&
    bodyText.trim() &&
    (bodyVariables.length === 0 || bodyExamples.every((e) => e.trim()));

  const getPreview = () => {
    let preview = bodyText;
    bodyExamples.forEach((ex, i) => {
      preview = preview.replace(`{{${i + 1}}}`, ex || `{{${i + 1}}}`);
    });
    return preview;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const components: any[] = [];

      // Header
      if (hasHeader && headerText.trim()) {
        const headerComp: any = { type: "HEADER", format: headerFormat, text: headerText };
        if (headerVariables.length > 0 && headerExample.trim()) {
          headerComp.example = { header_text: [headerExample] };
        }
        components.push(headerComp);
      }

      // Body
      const bodyComp: any = { type: "BODY", text: bodyText };
      if (bodyVariables.length > 0 && bodyExamples.length > 0) {
        bodyComp.example = { body_text: [bodyExamples] };
      }
      components.push(bodyComp);

      // Footer
      if (hasFooter && footerText.trim()) {
        components.push({ type: "FOOTER", text: footerText });
      }

      // Buttons
      if (buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: buttons.map((btn) => {
            if (btn.type === "URL") {
              return { type: "URL", text: btn.text, url: btn.url };
            } else if (btn.type === "PHONE_NUMBER") {
              return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone_number };
            } else {
              return { type: "QUICK_REPLY", text: btn.text };
            }
          }),
        });
      }

      const { data, error } = await supabase.functions.invoke("create-whatsapp-template", {
        body: {
          name: name.trim(),
          category,
          language,
          components,
          allow_category_change: allowCategoryChange,
        },
      });

      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.error || "Failed to create template");
        return;
      }

      toast.success(data?.message || "Template submitted for approval!");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          onOpenChange(v);
          if (!v) resetForm();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create WhatsApp Template</DialogTitle>
          <DialogDescription>
            Submit a new message template for WhatsApp approval. Review typically takes up to 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., order_update"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {name && (
                <p className="text-xs text-muted-foreground">
                  API name: <code className="bg-muted px-1 rounded">{displayName}</code>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div>
                        <span>{c.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{c.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Language *</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allow Category Change</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch checked={allowCategoryChange} onCheckedChange={setAllowCategoryChange} />
                <span className="text-sm text-muted-foreground">
                  {allowCategoryChange ? "Meta can reassign category" : "Strict category"}
                </span>
              </div>
            </div>
          </div>

          {/* Header */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Header (optional)</Label>
                <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
              </div>
              {hasHeader && (
                <div className="space-y-2">
                  <Input
                    placeholder="Header text, e.g., Order Update"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                  />
                  {headerVariables.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Example for header variable</Label>
                      <Input
                        placeholder="e.g., John Doe"
                        value={headerExample}
                        onChange={(e) => setHeaderExample(e.target.value)}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Use {"{{1}}"} for variables. Only text headers supported via API.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Body */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Label className="text-sm font-semibold">Body *</Label>
              <Textarea
                placeholder={"Hi {{1}}, your order {{2}} has been confirmed."}
                value={bodyText}
                onChange={(e) => syncBodyExamples(e.target.value)}
                rows={3}
              />
              {bodyVariables.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Sample values for variables (required by WhatsApp)
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {bodyVariables.map((v, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{v}</Label>
                        <Input
                          placeholder={`Sample for ${v}`}
                          value={bodyExamples[i] || ""}
                          onChange={(e) => {
                            const updated = [...bodyExamples];
                            updated[i] = e.target.value;
                            setBodyExamples(updated);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Use {"{{1}}"}, {"{{2}}"}, etc. for dynamic variables. Max 1024 characters.
              </p>
            </CardContent>
          </Card>

          {/* Footer */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Footer (optional)</Label>
                <Switch checked={hasFooter} onCheckedChange={setHasFooter} />
              </div>
              {hasFooter && (
                <Input
                  placeholder="e.g., Reply STOP to opt out"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  maxLength={60}
                />
              )}
            </CardContent>
          </Card>

          {/* Buttons */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Buttons (optional, max 3)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={buttons.length >= 3}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {buttons.map((btn, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={btn.type}
                        onValueChange={(v) => updateButton(idx, "type", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="URL">URL</SelectItem>
                          <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                          <SelectItem value="PHONE_NUMBER">Phone Number</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Button text"
                        value={btn.text}
                        onChange={(e) => updateButton(idx, "text", e.target.value)}
                      />
                    </div>
                    {btn.type === "URL" && (
                      <Input
                        className="h-8 text-xs"
                        placeholder="https://example.com/..."
                        value={btn.url || ""}
                        onChange={(e) => updateButton(idx, "url", e.target.value)}
                      />
                    )}
                    {btn.type === "PHONE_NUMBER" && (
                      <Input
                        className="h-8 text-xs"
                        placeholder="+919876543210"
                        value={btn.phone_number || ""}
                        onChange={(e) => updateButton(idx, "phone_number", e.target.value)}
                      />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeButton(idx)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Preview */}
          {bodyText && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <Label className="text-sm font-semibold">Preview</Label>
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg space-y-2">
                  {hasHeader && headerText && (
                    <p className="font-semibold text-sm">{headerText}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{getPreview()}</p>
                  {hasFooter && footerText && (
                    <p className="text-xs text-muted-foreground">{footerText}</p>
                  )}
                  {buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      {buttons.map((btn, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {btn.text || "Button"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit for Approval"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
