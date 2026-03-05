import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2, Sparkles, Link, X, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RecipientData {
  id: string;
  name: string;
  email: string;
  mobile_numb?: string;
  mobile2?: string;
  official?: string;
  personal_email_id?: string;
  generic_email_id?: string;
  linkedin?: string;
  designation?: string;
  deppt?: string;
  job_level_updated?: string;
  company_name?: string;
  industry_type?: string;
  sub_industry?: string;
  address?: string;
  location?: string;
  city?: string;
  state?: string;
  zone?: string;
  tier?: string;
  pincode?: string;
  website?: string;
  turnover?: string;
  emp_size?: string;
  erp_name?: string;
  erp_vendor?: string;
  activity_name?: string;
  latest_disposition?: string;
  latest_subdisposition?: string;
  last_call_date?: string;
}

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientData: RecipientData;
  onEmailSent?: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category?: string;
}

interface Attachment {
  name: string;
  content_base64: string;
  content_type: string;
  size: number;
}

export function EmailComposeDialog({ 
  open, 
  onOpenChange, 
  recipientData,
  onEmailSent 
}: EmailComposeDialogProps) {
  const [mode, setMode] = useState<'simple' | 'template'>('simple');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccInput, setBccInput] = useState("");
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState<boolean | null>(null);
  const [outlookEmail, setOutlookEmail] = useState<string>("");
  const [connecting, setConnecting] = useState(false);

  const draftKey = `email-draft-${recipientData.id}`;

  // Save draft to sessionStorage whenever form fields change
  useEffect(() => {
    if (open && (subject || body || ccEmails.length || bccEmails.length)) {
      const draft = { subject, body, ccEmails, bccEmails, mode, selectedTemplateId };
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    }
  }, [open, subject, body, ccEmails, bccEmails, mode, selectedTemplateId, draftKey]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      checkOutlookConnection();
      // Try to restore draft instead of resetting
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          setMode(draft.mode || 'simple');
          setSelectedTemplateId(draft.selectedTemplateId || "");
          setSubject(draft.subject || "");
          setBody(draft.body || "");
          setCcEmails(draft.ccEmails || []);
          setBccEmails(draft.bccEmails || []);
          setCcInput("");
          setBccInput("");
          setAttachments([]);
        } catch {
          resetForm();
        }
      } else {
        resetForm();
      }
    }
  }, [open]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setSubject(template.subject);
        setBody(template.body_html);
      }
    }
  }, [selectedTemplateId, templates]);

  const checkOutlookConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_oauth_tokens')
        .select('microsoft_email')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft')
        .maybeSingle();
      setOutlookConnected(!!data);
      setOutlookEmail(data?.microsoft_email || '');
    } catch {
      setOutlookConnected(false);
    }
  };

  const handleConnectOutlook = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('microsoft-auth-url', {
        body: { redirect_path: window.location.pathname },
      });
      if (error) throw error;
      if (data?.auth_url) window.location.href = data.auth_url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start Outlook connection');
      setConnecting(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, body_html, category')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTemplates(data || []);
    } catch {
      toast.error('Failed to load email templates');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setMode('simple');
    setSelectedTemplateId("");
    setSubject("");
    setBody("");
    setCcInput("");
    setCcEmails([]);
    setBccInput("");
    setBccEmails([]);
    setAttachments([]);
  };

  const addEmailChip = (input: string, setter: (v: string) => void, list: string[], listSetter: (v: string[]) => void) => {
    const email = input.trim();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Invalid email address');
      return;
    }
    if (!list.includes(email)) {
      listSetter([...list, email]);
    }
    setter("");
  };

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    for (const file of Array.from(files)) {
      if (totalSize + file.size > MAX_SIZE) {
        toast.error('Total attachment size exceeds 10MB limit');
        break;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          name: file.name,
          content_base64: base64,
          content_type: file.type || 'application/octet-stream',
          size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getMergeData = (): Record<string, any> => {
    const name = recipientData.name || '';
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    return {
      name, first_name: firstName, last_name: lastName,
      email: recipientData.email,
      phone: recipientData.mobile_numb || '',
      mobile2: recipientData.mobile2 || '',
      official: recipientData.official || '',
      designation: recipientData.designation || '',
      department: recipientData.deppt || '',
      job_level_updated: recipientData.job_level_updated || '',
      company_name: recipientData.company_name || '',
      industry: recipientData.industry_type || '',
      sub_industry: recipientData.sub_industry || '',
      location: recipientData.location || '',
      city: recipientData.city || '',
      state: recipientData.state || '',
      zone: recipientData.zone || '',
      tier: recipientData.tier || '',
      pincode: recipientData.pincode || '',
      address: recipientData.address || '',
      website: recipientData.website || '',
      turnover: recipientData.turnover || '',
      emp_size: recipientData.emp_size || '',
      erp_name: recipientData.erp_name || '',
      erp_vendor: recipientData.erp_vendor || '',
      activity_name: recipientData.activity_name || '',
      linkedin: recipientData.linkedin || '',
      latest_disposition: recipientData.latest_disposition || '',
      latest_subdisposition: recipientData.latest_subdisposition || '',
      last_call_date: recipientData.last_call_date || '',
    };
  };

  const insertMergeTag = (tag: string) => {
    setBody(prev => prev + ` {{${tag}}}`);
  };

  const getPreviewBody = (): string => {
    let preview = body;
    const mergeData = getMergeData();
    Object.keys(mergeData).forEach(key => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), mergeData[key] || '');
    });
    return preview;
  };

  const validateForm = (): boolean => {
    if (!subject.trim()) { toast.error('Please enter an email subject'); return false; }
    if (!body.trim()) { toast.error('Please enter email content'); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientData.email)) { toast.error('Invalid recipient email address'); return false; }
    return true;
  };

  const handleSendEmail = async () => {
    if (!validateForm()) return;
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please log in to send emails'); return; }

      const { data, error } = await supabase.functions.invoke('microsoft-send-email', {
        body: {
          to_email: recipientData.email,
          to_name: recipientData.name,
          subject,
          html_body: body,
          cc_emails: ccEmails.length ? ccEmails : undefined,
          bcc_emails: bccEmails.length ? bccEmails : undefined,
          attachments: attachments.length ? attachments.map(a => ({
            name: a.name, content_base64: a.content_base64, content_type: a.content_type,
          })) : undefined,
          demandcom_id: recipientData.id,
          template_id: selectedTemplateId || undefined,
          merge_data: getMergeData(),
        },
      });

      if (error) throw error;
      toast.success(`Email sent via Outlook to ${recipientData.name}`);
      sessionStorage.removeItem(draftKey);
      onEmailSent?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      if (error.message?.includes('Outlook not connected') || error.message?.includes('reconnect')) {
        setOutlookConnected(false);
      }
      toast.error(error.message || 'Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const commonMergeTags = [
    { key: 'name', label: 'Full Name' },
    { key: 'designation', label: 'Designation' },
    { key: 'company_name', label: 'Company' },
    { key: 'location', label: 'Location' },
    { key: 'city', label: 'City' },
  ];

  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.size, 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isSending && onOpenChange(isOpen)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {recipientData.name}
          </DialogTitle>
          <DialogDescription>
            {outlookConnected ? `Sending from ${outlookEmail}` : 'Connect Outlook to send emails'}
          </DialogDescription>
        </DialogHeader>

        {/* Outlook not connected state */}
        {outlookConnected === false && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Mail className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Connect your Microsoft Outlook account to send emails directly from your mailbox.
            </p>
            <Button onClick={handleConnectOutlook} disabled={connecting}>
              {connecting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                <><Link className="h-4 w-4 mr-2" />Connect Outlook</>
              )}
            </Button>
          </div>
        )}

        {/* Loading state */}
        {outlookConnected === null && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Connected - show compose form */}
        {outlookConnected === true && (
          <>
            <div className="space-y-6">
              {/* Mode Selection */}
              <div className="space-y-3">
                <Label>Email Mode</Label>
                <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'simple' | 'template')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="simple" id="simple" />
                    <Label htmlFor="simple" className="font-normal cursor-pointer">Simple Compose</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="template" id="template" />
                    <Label htmlFor="template" className="font-normal cursor-pointer">Use Template</Label>
                  </div>
                </RadioGroup>
              </div>

              {mode === 'template' && (
                <div className="space-y-2">
                  <Label>Select Template</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Choose an email template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                          {template.category && <Badge variant="outline" className="ml-2">{template.category}</Badge>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recipient Info */}
              <Card className="p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">To:</span> {recipientData.email}</div>
                  <div><span className="font-medium">From:</span> {outlookEmail}</div>
                  {recipientData.designation && <div><span className="font-medium">Designation:</span> {recipientData.designation}</div>}
                  {recipientData.company_name && <div><span className="font-medium">Company:</span> {recipientData.company_name}</div>}
                </div>
              </Card>

              {/* CC */}
              <div className="space-y-2">
                <Label>CC</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {ccEmails.map((email, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {email}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setCcEmails(ccEmails.filter((_, idx) => idx !== i))} />
                    </Badge>
                  ))}
                </div>
                <Input
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmailChip(ccInput, setCcInput, ccEmails, setCcEmails); }}}
                  onBlur={() => ccInput && addEmailChip(ccInput, setCcInput, ccEmails, setCcEmails)}
                  placeholder="Add CC email and press Enter"
                  disabled={isSending}
                />
              </div>

              {/* BCC */}
              <div className="space-y-2">
                <Label>BCC</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {bccEmails.map((email, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {email}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setBccEmails(bccEmails.filter((_, idx) => idx !== i))} />
                    </Badge>
                  ))}
                </div>
                <Input
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmailChip(bccInput, setBccInput, bccEmails, setBccEmails); }}}
                  onBlur={() => bccInput && addEmailChip(bccInput, setBccInput, bccEmails, setBccEmails)}
                  placeholder="Add BCC email and press Enter"
                  disabled={isSending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your email subject..." required disabled={isSending} />
              </div>

              {/* Merge Tags */}
              <div className="space-y-2">
                <Label>Quick Personalization</Label>
                <div className="flex flex-wrap gap-2">
                  {commonMergeTags.map((tag) => (
                    <Button key={tag.key} type="button" variant="outline" size="sm" onClick={() => insertMergeTag(tag.key)} disabled={isSending} className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />{tag.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Message <span className="text-destructive">*</span></Label>
                <Textarea
                  id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={12}
                  placeholder={`Hi {{name}},\n\nI hope this message finds you well.\n\n[Your message here]\n\nBest regards`}
                  required disabled={isSending} className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Use {"{{merge_tag}}"} syntax for personalization. HTML is supported.</p>
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={isSending} asChild>
                    <label className="cursor-pointer">
                      <Paperclip className="h-3 w-3 mr-1" />
                      Add Files
                      <input type="file" multiple className="hidden" onChange={handleFileAttachment} />
                    </label>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {totalAttachmentSize > 0
                      ? `${(totalAttachmentSize / 1024 / 1024).toFixed(1)} MB / 10 MB`
                      : 'Max 10 MB total'}
                  </span>
                </div>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {attachments.map((a, i) => (
                      <Badge key={i} variant="outline" className="gap-1">
                        {a.name} ({(a.size / 1024).toFixed(0)} KB)
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeAttachment(i)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview */}
              {body && (
                <div className="space-y-2">
                  <Label>Preview (with merge tags replaced)</Label>
                  <Card className="p-4 bg-muted/30">
                    <div className="text-sm whitespace-pre-wrap">{getPreviewBody()}</div>
                  </Card>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
              <Button type="button" onClick={handleSendEmail} disabled={isSending || !subject.trim() || !body.trim()}>
                {isSending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending via Outlook...</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" />Send via Outlook</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
