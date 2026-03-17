import { useState, useRef, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Image,
  Video,
  FileText,
  Type,
  Phone,
  Link2,
  MessageSquare,
  Copy,
  Workflow,
  Bold,
  Italic,
  Strikethrough,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// ─── Constants ───

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "bn", label: "Bengali" },
  { value: "gu", label: "Gujarati" },
  { value: "pa", label: "Punjabi" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "pt_BR", label: "Portuguese (BR)" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "id", label: "Indonesian" },
];

type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

const HEADER_OPTIONS: { value: HeaderType; label: string; icon: typeof Type | null }[] = [
  { value: "NONE", label: "None", icon: null },
  { value: "TEXT", label: "Text", icon: Type },
  { value: "IMAGE", label: "Image", icon: Image },
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "DOCUMENT", label: "Document", icon: FileText },
];

type ButtonType = "URL" | "PHONE_NUMBER" | "QUICK_REPLY" | "COPY_CODE" | "FLOW";

const BUTTON_TYPE_OPTIONS: { value: ButtonType; label: string; icon: typeof Link2 }[] = [
  { value: "QUICK_REPLY", label: "Quick Reply", icon: MessageSquare },
  { value: "URL", label: "Visit Website", icon: Link2 },
  { value: "PHONE_NUMBER", label: "Call Phone", icon: Phone },
  { value: "COPY_CODE", label: "Copy Code", icon: Copy },
  { value: "FLOW", label: "Flow", icon: Workflow },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 16 * 1024 * 1024;
const MAX_DOC_SIZE = 100 * 1024 * 1024;

// ─── Types ───

interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
  flow_id?: string;
  flow_action?: string;
}

interface BuilderForm {
  name: string;
  category: string;
  language: string;
  headerType: HeaderType;
  headerText: string;
  bodyText: string;
  footerText: string;
  buttons: TemplateButton[];
  sampleValues: string[];
}

const emptyForm: BuilderForm = {
  name: "",
  category: "MARKETING",
  language: "en",
  headerType: "NONE",
  headerText: "",
  bodyText: "",
  footerText: "",
  buttons: [],
  sampleValues: [],
};

// ─── Helpers ───

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  const unique = [...new Set(matches)];
  unique.sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
  return unique;
}

function resolveText(text: string, samples: string[]): string {
  let resolved = text;
  samples.forEach((val, i) => {
    if (val) resolved = resolved.replaceAll(`{{${i + 1}}}`, val);
  });
  return resolved;
}

function formatWhatsAppText(text: string): JSX.Element[] {
  const parts: JSX.Element[] = [];
  const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const m = match[0];
    if (m.startsWith("*") && m.endsWith("*")) parts.push(<strong key={key++}>{m.slice(1, -1)}</strong>);
    else if (m.startsWith("_") && m.endsWith("_")) parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
    else if (m.startsWith("~") && m.endsWith("~")) parts.push(<s key={key++}>{m.slice(1, -1)}</s>);
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  return parts;
}

// ─── WhatsApp Preview ───

function WhatsAppPreview({ form, mediaPreviewUrl }: { form: BuilderForm; mediaPreviewUrl: string | null }) {
  const resolvedBody = resolveText(form.bodyText, form.sampleValues);
  const resolvedHeader = resolveText(form.headerText, form.sampleValues);
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const ctaButtons = form.buttons.filter(
    (b) => b.type === "URL" || b.type === "PHONE_NUMBER" || b.type === "FLOW" || b.type === "COPY_CODE"
  );
  const quickReplies = form.buttons.filter((b) => b.type === "QUICK_REPLY");

  return (
    <div className="flex flex-col items-center">
      <div className="w-[260px] rounded-[2rem] border-[3px] border-foreground/15 bg-[#e5ddd5] shadow-xl overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center gap-2 bg-[#075e54] px-4 py-2">
          <div className="h-7 w-7 rounded-full bg-white/20" />
          <div>
            <p className="text-xs font-medium text-white">Business</p>
            <p className="text-[10px] text-white/60">online</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="min-h-[320px] space-y-1 p-3">
          <div className="max-w-[230px] rounded-lg rounded-tl-none bg-white shadow-sm overflow-hidden">
            {/* Header */}
            {form.headerType === "TEXT" && form.headerText.trim() && (
              <p className="px-2.5 pt-2 text-[12px] font-bold text-gray-900">{resolvedHeader}</p>
            )}
            {form.headerType === "IMAGE" && (
              <div className="flex h-28 items-center justify-center bg-gray-100">
                {mediaPreviewUrl ? (
                  <img src={mediaPreviewUrl} alt="Header" className="h-full w-full object-cover" />
                ) : (
                  <Image className="h-8 w-8 text-gray-300" />
                )}
              </div>
            )}
            {form.headerType === "VIDEO" && (
              <div className="flex h-28 items-center justify-center bg-gray-900">
                {mediaPreviewUrl ? (
                  <video src={mediaPreviewUrl} className="h-full w-full object-cover" muted />
                ) : (
                  <Video className="h-8 w-8 text-gray-500" />
                )}
              </div>
            )}
            {form.headerType === "DOCUMENT" && (
              <div className="flex h-14 items-center gap-2 bg-gray-100 px-3">
                <FileText className="h-6 w-6 text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium text-gray-700">document.pdf</p>
                  <p className="text-[9px] text-gray-400">PDF</p>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="px-2.5 pt-1.5 pb-1">
              <p className="whitespace-pre-wrap text-[12px] leading-[16px] text-gray-900">
                {resolvedBody ? formatWhatsAppText(resolvedBody) : (
                  <span className="italic text-gray-400">Message body...</span>
                )}
              </p>
            </div>

            {/* Footer + time */}
            <div className="flex items-end justify-between gap-2 px-2.5 pb-1.5">
              {form.footerText.trim() ? (
                <p className="text-[10px] text-gray-400">{form.footerText}</p>
              ) : <span />}
              <span className="text-[9px] text-gray-400 whitespace-nowrap">{time}</span>
            </div>
          </div>

          {/* CTA Buttons */}
          {ctaButtons.length > 0 && (
            <div className="max-w-[230px] space-y-px rounded-lg bg-white shadow-sm overflow-hidden">
              {ctaButtons.map((btn, i) => (
                <button
                  key={i}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 py-1.5 text-[12px] font-medium text-[#00a5f4] first:border-t-0"
                >
                  {btn.type === "URL" && <Link2 className="h-3 w-3" />}
                  {btn.type === "PHONE_NUMBER" && <Phone className="h-3 w-3" />}
                  {btn.type === "COPY_CODE" && <Copy className="h-3 w-3" />}
                  {btn.type === "FLOW" && <Workflow className="h-3 w-3" />}
                  {btn.text || "Button"}
                </button>
              ))}
            </div>
          )}

          {/* Quick Replies */}
          {quickReplies.length > 0 && (
            <div className="flex max-w-[230px] flex-wrap gap-1">
              {quickReplies.map((btn, i) => (
                <button
                  key={i}
                  className="flex-1 rounded-lg bg-white py-1.5 text-center text-[12px] font-medium text-[#00a5f4] shadow-sm min-w-[60px]"
                >
                  {btn.text || "Reply"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-muted-foreground">Live Preview</p>
    </div>
  );
}

// ─── Main Dialog ───

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<BuilderForm>({ ...emptyForm });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const bodyVariables = useMemo(() => extractVariables(form.bodyText), [form.bodyText]);
  const headerVariables = useMemo(() => extractVariables(form.headerText), [form.headerText]);
  const allVariables = useMemo(() => {
    const all = [...new Set([...bodyVariables, ...headerVariables])];
    all.sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
    return all;
  }, [bodyVariables, headerVariables]);

  // Adjust sample values when variables change
  useEffect(() => {
    const maxVar = allVariables.length > 0
      ? Math.max(...allVariables.map((v) => parseInt(v.replace(/\D/g, ""))))
      : 0;
    if (form.sampleValues.length < maxVar) {
      setForm((prev) => ({
        ...prev,
        sampleValues: [...prev.sampleValues, ...Array(maxVar - prev.sampleValues.length).fill("")],
      }));
    }
  }, [allVariables]);

  // Reset media when header type changes
  useEffect(() => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setMediaError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [form.headerType]);

  const updateForm = (patch: Partial<BuilderForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const resetForm = () => {
    setForm({ ...emptyForm });
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setMediaError(null);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (form.headerType === "IMAGE") {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setMediaError("Only JPG and PNG images are allowed.");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setMediaError(`Image must be under 5 MB. Selected: ${(file.size / 1048576).toFixed(1)} MB.`);
        return;
      }
    } else if (form.headerType === "VIDEO") {
      if (file.type !== "video/mp4") {
        setMediaError("Only MP4 videos are allowed.");
        return;
      }
      if (file.size > MAX_VIDEO_SIZE) {
        setMediaError(`Video must be under 16 MB. Selected: ${(file.size / 1048576).toFixed(1)} MB.`);
        return;
      }
    } else if (form.headerType === "DOCUMENT") {
      if (file.size > MAX_DOC_SIZE) {
        setMediaError(`Document must be under 100 MB. Selected: ${(file.size / 1048576).toFixed(1)} MB.`);
        return;
      }
    }

    setMediaFile(file);
    if (form.headerType === "IMAGE" || form.headerType === "VIDEO") {
      setMediaPreviewUrl(URL.createObjectURL(file));
    } else {
      setMediaPreviewUrl(null);
    }
  };

  const insertVariable = () => {
    const nextNum = allVariables.length > 0
      ? Math.max(...allVariables.map((v) => parseInt(v.replace(/\D/g, "")))) + 1
      : 1;
    const textarea = bodyRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = form.bodyText.slice(0, start) + `{{${nextNum}}}` + form.bodyText.slice(end);
      updateForm({ bodyText: newText });
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + `{{${nextNum}}}`.length;
      }, 0);
    } else {
      updateForm({ bodyText: form.bodyText + `{{${nextNum}}}` });
    }
  };

  const insertFormatting = (wrapper: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = form.bodyText.slice(start, end);
    const newText = form.bodyText.slice(0, start) + wrapper + (selected || "text") + wrapper + form.bodyText.slice(end);
    updateForm({ bodyText: newText });
    setTimeout(() => {
      textarea.focus();
      if (selected) {
        textarea.selectionStart = start;
        textarea.selectionEnd = end + wrapper.length * 2;
      } else {
        textarea.selectionStart = start + wrapper.length;
        textarea.selectionEnd = start + wrapper.length + 4;
      }
    }, 0);
  };

  const addButton = (type: ButtonType) => {
    if (form.buttons.length >= 10) {
      toast.error("Maximum 10 buttons allowed.");
      return;
    }
    const qrCount = form.buttons.filter((b) => b.type === "QUICK_REPLY").length;
    const urlCount = form.buttons.filter((b) => b.type === "URL").length;
    const phoneCount = form.buttons.filter((b) => b.type === "PHONE_NUMBER").length;
    const copyCount = form.buttons.filter((b) => b.type === "COPY_CODE").length;

    if (type === "QUICK_REPLY" && qrCount >= 3) { toast.error("Maximum 3 quick reply buttons."); return; }
    if (type === "URL" && urlCount >= 2) { toast.error("Maximum 2 URL buttons."); return; }
    if (type === "PHONE_NUMBER" && phoneCount >= 1) { toast.error("Maximum 1 phone button."); return; }
    if (type === "COPY_CODE" && copyCount >= 1) { toast.error("Maximum 1 copy code button."); return; }

    const newBtn: TemplateButton = { type, text: "" };
    if (type === "FLOW") newBtn.flow_action = "navigate";
    updateForm({ buttons: [...form.buttons, newBtn] });
  };

  const updateButton = (index: number, patch: Partial<TemplateButton>) => {
    const updated = [...form.buttons];
    updated[index] = { ...updated[index], ...patch };
    updateForm({ buttons: updated });
  };

  const removeButton = (index: number) => {
    updateForm({ buttons: form.buttons.filter((_, i) => i !== index) });
  };

  const buildComponents = () => {
    const components: any[] = [];

    // Header
    if (form.headerType === "TEXT" && form.headerText.trim()) {
      const headerComp: any = { type: "HEADER", format: "TEXT", text: form.headerText };
      const hVars = extractVariables(form.headerText);
      if (hVars.length > 0) {
        headerComp.example = {
          header_text: hVars.map((v) => {
            const idx = parseInt(v.replace(/\D/g, "")) - 1;
            return form.sampleValues[idx] || `sample${idx + 1}`;
          }),
        };
      }
      components.push(headerComp);
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType)) {
      components.push({ type: "HEADER", format: form.headerType });
    }

    // Body
    const bodyComp: any = { type: "BODY", text: form.bodyText };
    const bVars = extractVariables(form.bodyText);
    if (bVars.length > 0) {
      bodyComp.example = {
        body_text: [bVars.map((v) => {
          const idx = parseInt(v.replace(/\D/g, "")) - 1;
          return form.sampleValues[idx] || `sample${idx + 1}`;
        })],
      };
    }
    components.push(bodyComp);

    // Footer
    if (form.footerText.trim()) {
      components.push({ type: "FOOTER", text: form.footerText });
    }

    // Buttons
    if (form.buttons.length > 0) {
      const buttons = form.buttons.map((btn) => {
        const b: any = { type: btn.type, text: btn.text };
        if (btn.type === "URL" && btn.url) {
          b.url = btn.url;
          if (btn.url.includes("{{")) {
            b.example = [btn.url.replace(/\{\{\d+\}\}/g, "https://example.com")];
          }
        }
        if (btn.type === "PHONE_NUMBER" && btn.phone_number) b.phone_number = btn.phone_number;
        if (btn.type === "COPY_CODE") b.example = [btn.text || "COPYCODE"];
        if (btn.type === "FLOW") {
          if (btn.flow_id) b.flow_id = btn.flow_id;
          b.flow_action = btn.flow_action || "navigate";
        }
        return b;
      });
      components.push({ type: "BUTTONS", buttons });
    }

    return components;
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Template name is required."); return; }
    if (!form.bodyText.trim()) { toast.error("Message body is required."); return; }
    for (const btn of form.buttons) {
      if (!btn.text.trim()) { toast.error("All buttons must have label text."); return; }
      if (btn.type === "URL" && !btn.url?.trim()) { toast.error("URL buttons require a URL."); return; }
      if (btn.type === "PHONE_NUMBER" && !btn.phone_number?.trim()) { toast.error("Phone buttons require a phone number."); return; }
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-whatsapp-template", {
        body: {
          name: form.name.trim(),
          category: form.category,
          language: form.language,
          components: buildComponents(),
          allow_category_change: true,
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

  const bodyCharCount = form.bodyText.length;

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
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create WhatsApp Template</DialogTitle>
          <DialogDescription>
            Build your message template with all supported WhatsApp components. Review typically takes up to 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 items-start">
          {/* Left: Form */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Template Name *</Label>
                  <Input
                    placeholder="order_confirmation"
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Category *</Label>
                    <Select value={form.category} onValueChange={(v) => updateForm({ category: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Language *</Label>
                    <Select value={form.language} onValueChange={(v) => updateForm({ language: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Header */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Header</CardTitle>
                <CardDescription className="text-xs">Optional. Add a text, image, video, or document header.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {HEADER_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={form.headerType === opt.value ? "default" : "outline"}
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => updateForm({ headerType: opt.value, headerText: "" })}
                    >
                      {opt.icon && <opt.icon className="h-3.5 w-3.5" />}
                      {opt.label}
                    </Button>
                  ))}
                </div>

                {form.headerType === "TEXT" && (
                  <div>
                    <Input
                      placeholder="e.g., Order Update"
                      value={form.headerText}
                      onChange={(e) => updateForm({ headerText: e.target.value })}
                      maxLength={60}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {form.headerText.length}/60 characters. Use {"{{1}}"} for variables.
                    </p>
                  </div>
                )}

                {form.headerType === "IMAGE" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3.5 w-3.5" /> Upload Image
                      </Button>
                      {mediaFile && <span className="truncate text-xs text-muted-foreground max-w-[180px]">{mediaFile.name}</span>}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handleMediaSelect} />
                    <p className="text-[11px] text-muted-foreground">JPG or PNG, max 5 MB</p>
                    {mediaError && <p className="text-xs font-medium text-destructive">{mediaError}</p>}
                  </div>
                )}

                {form.headerType === "VIDEO" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3.5 w-3.5" /> Upload Video
                      </Button>
                      {mediaFile && <span className="truncate text-xs text-muted-foreground max-w-[180px]">{mediaFile.name}</span>}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".mp4" className="hidden" onChange={handleMediaSelect} />
                    <p className="text-[11px] text-muted-foreground">MP4 only, max 16 MB</p>
                    {mediaError && <p className="text-xs font-medium text-destructive">{mediaError}</p>}
                  </div>
                )}

                {form.headerType === "DOCUMENT" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3.5 w-3.5" /> Upload Document
                      </Button>
                      {mediaFile && <span className="truncate text-xs text-muted-foreground max-w-[180px]">{mediaFile.name}</span>}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleMediaSelect} />
                    <p className="text-[11px] text-muted-foreground">PDF, DOC, XLS, PPT. Max 100 MB</p>
                    {mediaError && <p className="text-xs font-medium text-destructive">{mediaError}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Body */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Body *</CardTitle>
                <CardDescription className="text-xs">The main message text. Use variables for personalization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-1 rounded-md border p-1 w-fit">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Bold" onClick={() => insertFormatting("*")}>
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Italic" onClick={() => insertFormatting("_")}>
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Strikethrough" onClick={() => insertFormatting("~")}>
                    <Strikethrough className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={insertVariable}>
                    <Plus className="h-3 w-3" /> Variable
                  </Button>
                </div>

                <Textarea
                  ref={bodyRef}
                  placeholder="Hi {{1}}, your order {{2}} has been confirmed and will be delivered by {{3}}."
                  rows={4}
                  value={form.bodyText}
                  onChange={(e) => updateForm({ bodyText: e.target.value })}
                  maxLength={1024}
                />
                <p className={`text-[11px] ${bodyCharCount > 900 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {bodyCharCount}/1024 characters
                </p>
              </CardContent>
            </Card>

            {/* Sample Values */}
            {allVariables.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Sample Values</CardTitle>
                  <CardDescription className="text-xs">Provide example values for each variable. Required for WhatsApp approval.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allVariables.map((v) => {
                      const idx = parseInt(v.replace(/\D/g, "")) - 1;
                      return (
                        <div key={v} className="flex items-center gap-2">
                          <Badge variant="secondary" className="shrink-0 font-mono text-xs">{v}</Badge>
                          <Input
                            placeholder={`e.g., ${idx === 0 ? "John" : idx === 1 ? "ORD-123" : "sample"}`}
                            value={form.sampleValues[idx] || ""}
                            onChange={(e) => {
                              const updated = [...form.sampleValues];
                              updated[idx] = e.target.value;
                              updateForm({ sampleValues: updated });
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Footer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Footer</CardTitle>
                <CardDescription className="text-xs">Optional short text below the message. Max 60 characters.</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="e.g., Reply STOP to opt out"
                  value={form.footerText}
                  onChange={(e) => updateForm({ footerText: e.target.value })}
                  maxLength={60}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{form.footerText.length}/60 characters</p>
              </CardContent>
            </Card>

            {/* Buttons */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Buttons</CardTitle>
                    <CardDescription className="text-xs">Optional. Max 10 total (3 QR, 2 URL, 1 Phone, 1 Copy Code).</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add button row */}
                <div className="flex flex-wrap gap-1.5">
                  {BUTTON_TYPE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => addButton(opt.value)}
                    >
                      <opt.icon className="h-3 w-3" />
                      {opt.label}
                    </Button>
                  ))}
                </div>

                {form.buttons.map((btn, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] shrink-0">{btn.type.replace("_", " ")}</Badge>
                        <Input
                          className="h-7 text-xs flex-1"
                          placeholder="Button label (max 25 chars)"
                          value={btn.text}
                          maxLength={25}
                          onChange={(e) => updateButton(idx, { text: e.target.value })}
                        />
                      </div>
                      {btn.type === "URL" && (
                        <Input
                          className="h-7 text-xs"
                          placeholder="https://example.com/path/{{1}}"
                          value={btn.url || ""}
                          onChange={(e) => updateButton(idx, { url: e.target.value })}
                        />
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <Input
                          className="h-7 text-xs"
                          placeholder="+919876543210"
                          value={btn.phone_number || ""}
                          onChange={(e) => updateButton(idx, { phone_number: e.target.value })}
                        />
                      )}
                      {btn.type === "FLOW" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            className="h-7 text-xs"
                            placeholder="Flow ID"
                            value={btn.flow_id || ""}
                            onChange={(e) => updateButton(idx, { flow_id: e.target.value })}
                          />
                          <Select value={btn.flow_action || "navigate"} onValueChange={(v) => updateButton(idx, { flow_action: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="navigate">Navigate</SelectItem>
                              <SelectItem value="data_exchange">Data Exchange</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeButton(idx)}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-2 pb-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2 px-6">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit for Approval
              </Button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="hidden lg:block sticky top-4 shrink-0">
            <WhatsAppPreview form={form} mediaPreviewUrl={mediaPreviewUrl} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
