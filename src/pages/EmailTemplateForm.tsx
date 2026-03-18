import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { z } from "zod";
import rmplLogo from "@/assets/rmpl-logo.png";
import { logError, getSupabaseErrorMessage, getCurrentUserId } from "@/lib/errorLogger";

const emailTemplateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  body_html: z.string().min(10, "Body must be at least 10 characters"),
  body_text: z.string().optional(),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  button_text: z.string().max(50).optional().or(z.literal("")),
  button_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  facebook_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  twitter_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  linkedin_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagram_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  category: z.string().optional(),
  is_active: z.boolean(),
});

type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;

const MERGE_TAGS = [
  // Personal/Contact Information
  { tag: "{{name}}", description: "Full name", category: "Personal" },
  { tag: "{{first_name}}", description: "First name (computed from name)", category: "Personal" },
  { tag: "{{last_name}}", description: "Last name (computed from name)", category: "Personal" },
  { tag: "{{email}}", description: "Email address (personal or generic)", category: "Personal" },
  { tag: "{{phone}}", description: "Primary mobile number", category: "Personal" },
  { tag: "{{mobile2}}", description: "Secondary mobile number", category: "Personal" },
  { tag: "{{official}}", description: "Official phone number", category: "Personal" },
  { tag: "{{linkedin}}", description: "LinkedIn profile URL", category: "Personal" },
  
  // Professional Information
  { tag: "{{designation}}", description: "Job designation/title", category: "Professional" },
  { tag: "{{department}}", description: "Department (deppt field)", category: "Professional" },
  { tag: "{{job_level_updated}}", description: "Job level/seniority", category: "Professional" },
  
  // Company/Business Information
  { tag: "{{company_name}}", description: "Company name", category: "Company" },
  { tag: "{{industry}}", description: "Industry type", category: "Company" },
  { tag: "{{sub_industry}}", description: "Sub industry category", category: "Company" },
  { tag: "{{turnover}}", description: "Company revenue/turnover", category: "Company" },
  { tag: "{{emp_size}}", description: "Employee size/count", category: "Company" },
  { tag: "{{erp_name}}", description: "ERP system name", category: "Company" },
  { tag: "{{erp_vendor}}", description: "ERP vendor name", category: "Company" },
  { tag: "{{website}}", description: "Company website URL", category: "Company" },
  { tag: "{{activity_name}}", description: "Business activity name", category: "Company" },
  
  // Location Information
  { tag: "{{address}}", description: "Full address", category: "Location" },
  { tag: "{{location}}", description: "Location string", category: "Location" },
  { tag: "{{city}}", description: "City", category: "Location" },
  { tag: "{{state}}", description: "State", category: "Location" },
  { tag: "{{zone}}", description: "Geographic zone", category: "Location" },
  { tag: "{{tier}}", description: "City tier classification", category: "Location" },
  { tag: "{{pincode}}", description: "Postal/PIN code", category: "Location" },
  
  // Engagement History
  { tag: "{{latest_disposition}}", description: "Last call disposition", category: "Engagement" },
  { tag: "{{latest_subdisposition}}", description: "Last call sub-disposition", category: "Engagement" },
  { tag: "{{last_call_date}}", description: "Date of last call", category: "Engagement" },
];

export default function EmailTemplateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [activeField, setActiveField] = useState<'subject' | 'body_html'>('body_html');
  const [formData, setFormData] = useState<EmailTemplateFormData>({
    name: "",
    subject: "",
    body_html: "",
    body_text: "",
    image_url: "",
    button_text: "",
    button_url: "",
    facebook_url: "",
    twitter_url: "",
    linkedin_url: "",
    instagram_url: "",
    category: "",
    is_active: true,
  });

  useEffect(() => {
    checkAuth();
    if (isEditMode) {
      loadTemplate();
    }
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadTemplate = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          subject: data.subject,
          body_html: data.body_html,
          body_text: data.body_text || "",
          image_url: data.image_url || "",
          button_text: data.button_text || "",
          button_url: data.button_url || "",
          facebook_url: data.facebook_url || "",
          twitter_url: data.twitter_url || "",
          linkedin_url: data.linkedin_url || "",
          instagram_url: data.instagram_url || "",
          category: data.category || "",
          is_active: data.is_active,
        });
        if (data.image_url) {
          setImagePreview(data.image_url);
        }
      }
    } catch (error: any) {
      logError(error, {
        component: "EmailTemplateForm",
        operation: "FETCH_DATA",
        userId: await getCurrentUserId(supabase),
        metadata: { templateId: id },
      });
      toast.error(getSupabaseErrorMessage(error));
      navigate("/templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailTemplateSchema.parse(formData);
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl = formData.image_url;

      // Upload image if a new file was selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('email-templates')
          .upload(fileName, imageFile);

        if (uploadError) {
          logError(uploadError, {
            component: "EmailTemplateForm",
            operation: "UPLOAD_FILE",
            userId: user.id,
            metadata: { fileName, fileSize: imageFile.size, fileType: imageFile.type },
          });
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('email-templates')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const templateData: any = {
        name: formData.name,
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_text || null,
        image_url: imageUrl || null,
        button_text: formData.button_text || null,
        button_url: formData.button_url || null,
        facebook_url: formData.facebook_url || null,
        twitter_url: formData.twitter_url || null,
        linkedin_url: formData.linkedin_url || null,
        instagram_url: formData.instagram_url || null,
        category: formData.category || null,
        is_active: formData.is_active,
        created_by: user.id,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("email_templates")
          .update(templateData)
          .eq("id", id);

        if (error) throw error;
        toast.success("Email template updated successfully");
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert([templateData]);

        if (error) throw error;
        toast.success("Email template created successfully");
      }

      navigate("/templates");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logError(error, {
          component: "EmailTemplateForm",
          operation: "VALIDATE_FORM",
          userId: await getCurrentUserId(supabase),
          metadata: { field: error.errors[0].path.join("."), isEditMode },
        });
        toast.error(error.errors[0].message);
      } else {
        logError(error, {
          component: "EmailTemplateForm",
          operation: isEditMode ? "UPDATE_DATA" : "CREATE_DATA",
          userId: await getCurrentUserId(supabase),
          metadata: { templateId: id, templateName: formData.name },
        });
        toast.error(getSupabaseErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const insertMergeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      [activeField]: prev[activeField] + " " + tag,
    }));
  };

  const updateFormData = (field: keyof EmailTemplateFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/5 via-success-green/5 to-accent-purple/5">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={rmplLogo} alt="RMPL" className="h-12 w-auto" />
            <div>
              <h1 className="font-bold text-xl">RMPL OPM</h1>
              <p className="text-sm text-muted-foreground">
                {isEditMode ? "Edit Email Template" : "New Email Template"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{isEditMode ? "Edit Email Template" : "Create Email Template"}</CardTitle>
                <CardDescription>
                  Design an email template with merge tags for personalization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        Template Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateFormData("name", e.target.value)}
                        placeholder="Welcome Email"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => updateFormData("category", value)}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="welcome">Welcome</SelectItem>
                          <SelectItem value="follow-up">Follow-up</SelectItem>
                          <SelectItem value="project-alert">Project Alert</SelectItem>
                          <SelectItem value="newsletter">Newsletter</SelectItem>
                          <SelectItem value="promotional">Promotional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">
                      Subject Line <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => updateFormData("subject", e.target.value)}
                      onFocus={() => setActiveField('subject')}
                      placeholder="Great opportunities for {{first_name}}!"
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Click here then use merge tags from the sidebar →
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image_upload">Header Image (Optional)</Label>
                    <Input
                      id="image_upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={isLoading}
                      className="cursor-pointer"
                    />
                    {imagePreview && (
                      <div className="mt-2 relative">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="max-h-48 rounded-lg border object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview("");
                            updateFormData("image_url", "");
                          }}
                          disabled={isLoading}
                        >
                          Remove Image
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Upload a header image for your email template
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body_html">
                      Email Body (HTML) <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="body_html"
                      value={formData.body_html}
                      onChange={(e) => updateFormData("body_html", e.target.value)}
                      onFocus={() => setActiveField('body_html')}
                      rows={12}
                      placeholder="Hi {{first_name}},

We have exciting new opportunities for {{specialty}} professionals in {{location_city}}, {{location_state}}!

Click here to learn more: [Project Link]

Best regards,
RMPL Team"
                      required
                      disabled={isLoading}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body_text">Plain Text Version (Optional)</Label>
                    <Textarea
                      id="body_text"
                      value={formData.body_text}
                      onChange={(e) => updateFormData("body_text", e.target.value)}
                      rows={6}
                      placeholder="Plain text version for email clients that don't support HTML"
                      disabled={isLoading}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-4 p-6 border-2 border-primary/20 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-1 bg-primary rounded-full" />
                      <Label className="text-lg font-bold text-primary">Call-to-Action Button</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Add a prominent button to drive engagement in your email
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="button_text">Button Text</Label>
                        <Input
                          id="button_text"
                          value={formData.button_text}
                          onChange={(e) => updateFormData("button_text", e.target.value)}
                          placeholder="Apply Now"
                          disabled={isLoading}
                          className="font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="button_url">Button URL</Label>
                        <Input
                          id="button_url"
                          value={formData.button_url}
                          onChange={(e) => updateFormData("button_url", e.target.value)}
                          placeholder="https://example.com/apply"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Social Media Links (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add social media URLs to display share buttons in your email
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="facebook_url">Facebook URL</Label>
                        <Input
                          id="facebook_url"
                          value={formData.facebook_url}
                          onChange={(e) => updateFormData("facebook_url", e.target.value)}
                          placeholder="https://facebook.com/yourpage"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twitter_url">Twitter/X URL</Label>
                        <Input
                          id="twitter_url"
                          value={formData.twitter_url}
                          onChange={(e) => updateFormData("twitter_url", e.target.value)}
                          placeholder="https://twitter.com/yourhandle"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                        <Input
                          id="linkedin_url"
                          value={formData.linkedin_url}
                          onChange={(e) => updateFormData("linkedin_url", e.target.value)}
                          placeholder="https://linkedin.com/company/yourcompany"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="instagram_url">Instagram URL</Label>
                        <Input
                          id="instagram_url"
                          value={formData.instagram_url}
                          onChange={(e) => updateFormData("instagram_url", e.target.value)}
                          placeholder="https://instagram.com/yourhandle"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => updateFormData("is_active", e.target.checked)}
                      disabled={isLoading}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="is_active">Template is active</Label>
                  </div>

                  <div className="flex gap-4 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/templates")}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isEditMode ? "Update Template" : "Create Template"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Merge Tags Sidebar */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Available Merge Tags</CardTitle>
                <CardDescription>
                  Inserting into: <span className="font-semibold text-primary">
                    {activeField === 'subject' ? 'Subject Line' : 'Email Body'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Group by category */}
                {Object.entries(
                  MERGE_TAGS.reduce((acc, tag) => {
                    if (!acc[tag.category]) acc[tag.category] = [];
                    acc[tag.category].push(tag);
                    return acc;
                  }, {} as Record<string, typeof MERGE_TAGS>)
                ).map(([category, tags]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">{category}</h4>
                    {tags.map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => insertMergeTag(item.tag)}
                        className="w-full text-left p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
                        disabled={isLoading}
                      >
                        <div className="font-mono text-xs text-primary">{item.tag}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}