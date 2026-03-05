import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import rmplLogo from "@/assets/rmpl-logo.png";
import { logError, getSupabaseErrorMessage, getCurrentUserId } from "@/lib/errorLogger";

const smsTemplateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  body: z.string().min(10, "Body must be at least 10 characters").max(160, "SMS should be under 160 characters"),
  category: z.string().optional(),
  is_active: z.boolean(),
});

type SMSTemplateFormData = z.infer<typeof smsTemplateSchema>;

const MERGE_TAGS = [
  { tag: "{{first_name}}", description: "First name" },
  { tag: "{{last_name}}", description: "Last name" },
  { tag: "{{specialty}}", description: "Specialty" },
  { tag: "{{project_title}}", description: "Project title" },
  { tag: "{{location_city}}", description: "City" },
  { tag: "{{location_state}}", description: "State" },
  { tag: "{{location}}", description: "City, State" },
  { tag: "{{phone}}", description: "Phone" },
  { tag: "{{years_experience}}", description: "Years experience" },
  { tag: "{{availability}}", description: "Availability" },
];

export default function SMSTemplateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<SMSTemplateFormData>({
    name: "",
    body: "",
    category: "",
    is_active: true,
  });

  const characterCount = formData.body.length;
  const messageCount = Math.ceil(characterCount / 160);

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
        .from("sms_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          body: data.body,
          category: data.category || "",
          is_active: data.is_active,
        });
      }
    } catch (error: any) {
      logError(error, {
        component: "SMSTemplateForm",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      smsTemplateSchema.parse(formData);
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const templateData: any = {
        name: formData.name,
        body: formData.body,
        category: formData.category || null,
        is_active: formData.is_active,
        character_count: formData.body.length,
        created_by: user.id,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("sms_templates")
          .update(templateData)
          .eq("id", id);

        if (error) throw error;
        toast.success("SMS template updated successfully");
      } else {
        const { error } = await supabase
          .from("sms_templates")
          .insert([templateData]);

        if (error) throw error;
        toast.success("SMS template created successfully");
      }

      navigate("/templates");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logError(error, {
          component: "SMSTemplateForm",
          operation: "VALIDATE_FORM",
          userId: await getCurrentUserId(supabase),
          metadata: { field: error.errors[0].path.join("."), isEditMode },
        });
        toast.error(error.errors[0].message);
      } else {
        logError(error, {
          component: "SMSTemplateForm",
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
      body: prev.body + " " + tag,
    }));
  };

  const updateFormData = (field: keyof SMSTemplateFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/5 via-healthcare-teal/5 to-accent-purple/5">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={rmplLogo} alt="RMPL" className="h-12 w-auto" />
            <div>
              <h1 className="font-bold text-xl">RMPL OPM</h1>
              <p className="text-sm text-muted-foreground">
                {isEditMode ? "Edit SMS Template" : "New SMS Template"}
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
                <CardTitle>{isEditMode ? "Edit SMS Template" : "Create SMS Template"}</CardTitle>
                <CardDescription>
                  Create a concise SMS template with merge tags for personalization
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
                        placeholder="Project Alert SMS"
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
                          <SelectItem value="project-alert">Project Alert</SelectItem>
                          <SelectItem value="follow-up">Follow-up</SelectItem>
                          <SelectItem value="reminder">Reminder</SelectItem>
                          <SelectItem value="confirmation">Confirmation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="body">
                        SMS Message <span className="text-destructive">*</span>
                      </Label>
                      <div className="text-sm text-muted-foreground">
                        {characterCount}/160 chars
                        {messageCount > 1 && ` (${messageCount} messages)`}
                      </div>
                    </div>
                    <Textarea
                      id="body"
                      value={formData.body}
                      onChange={(e) => updateFormData("body", e.target.value)}
                      rows={6}
                      placeholder="Hi {{first_name}}, we have new {{specialty}} opportunities in {{location_city}}! Reply YES for details."
                      required
                      disabled={isLoading}
                      className="font-mono text-sm"
                    />
                    {characterCount > 160 && (
                      <p className="text-sm text-warning">
                        ⚠️ Message exceeds 160 characters and will be sent as {messageCount} separate messages
                      </p>
                    )}
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
                <CardDescription>Click to insert into your message</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {MERGE_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertMergeTag(item.tag)}
                    className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                    disabled={isLoading}
                  >
                    <div className="font-mono text-sm text-primary mb-1">{item.tag}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}