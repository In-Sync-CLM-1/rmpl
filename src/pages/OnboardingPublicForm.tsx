import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { OtpVerificationInput } from "@/components/onboarding/OtpVerificationInput";
import { Loader2, Upload, CheckCircle, FileText } from "lucide-react";
import rmplLogo from "@/assets/rmpl-logo.png";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const GENDERS = ["Male", "Female", "Other"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

interface FormData {
  full_name: string;
  gender: string;
  date_of_birth: string;
  marital_status: string;
  contact_number: string;
  qualifications: string;
  pan_number: string;
  aadhar_number: string;
  father_name: string;
  mother_name: string;
  emergency_contact_number: string;
  personal_email: string;
  present_address: string;
  permanent_address: string;
  uan_number: string;
  blood_group: string;
}

const initialFormData: FormData = {
  full_name: "", gender: "", date_of_birth: "", marital_status: "",
  contact_number: "", qualifications: "", pan_number: "", aadhar_number: "",
  father_name: "", mother_name: "", emergency_contact_number: "",
  personal_email: "", present_address: "", permanent_address: "",
  uan_number: "", blood_group: "",
};

type DocType = "aadhaar" | "pan" | "qualification" | "relieving_letter" | "cancelled_cheque";
const DOC_LABELS: Record<DocType, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  qualification: "Qualification Certificates",
  relieving_letter: "Appointment / Relieving Letter",
  cancelled_cheque: "Cancelled Cheque",
};

export default function OnboardingPublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  
  const [emailVerified, setEmailVerified] = useState(false);
  const [documents, setDocuments] = useState<Record<DocType, File | null>>({
    aadhaar: null, pan: null, qualification: null, relieving_letter: null, cancelled_cheque: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    const fetchForm = async () => {
      if (!slug) return;
      const { data, error } = await supabase
        .from("onboarding_forms")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) console.error(error);
      setForm(data);
      setLoading(false);
    };
    fetchForm();
  }, [slug]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!formData.full_name.trim()) e.full_name = "Name is required";
    if (!formData.contact_number.match(/^[6-9]\d{9}$/)) e.contact_number = "Valid 10-digit Indian mobile required";
    if (!formData.personal_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.personal_email = "Valid email required";
    if (formData.pan_number && !formData.pan_number.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) e.pan_number = "Invalid PAN format (e.g., ABCDE1234F)";
    if (formData.aadhar_number && !formData.aadhar_number.match(/^\d{12}$/)) e.aadhar_number = "Aadhaar must be 12 digits";
    if (formData.emergency_contact_number && !formData.emergency_contact_number.match(/^[6-9]\d{9}$/)) e.emergency_contact_number = "Valid 10-digit number required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    if (!emailVerified) { toast({ title: "Verify Email", description: "Please verify your email", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      // Insert submission with client-generated ID to avoid needing SELECT policy
      const submissionId = crypto.randomUUID();
      const { error: subErr } = await supabase
        .from("onboarding_submissions")
        .insert({
          id: submissionId,
          form_id: form.id,
          ...formData,
          phone_verified: false,
          email_verified: true,
        });
      if (subErr) throw subErr;

      // Upload documents
      for (const [docType, file] of Object.entries(documents)) {
        if (!file) continue;
        const filePath = `${submissionId}/${docType}/${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("onboarding-documents")
          .upload(filePath, file);
        if (upErr) {
          console.error(`Upload error for ${docType}:`, upErr);
          continue;
        }
        await supabase.from("onboarding_documents").insert({
          submission_id: submissionId,
          document_type: docType,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
        });
      }

      setSubmitted(true);
      toast({ title: "Submitted!", description: "Your onboarding form has been submitted successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!form) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-2">Form Not Found</h1>
      <p className="text-muted-foreground">This onboarding form is no longer available.</p>
    </div>
  );

  if (submitted) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
      <p className="text-muted-foreground text-center max-w-md">Your onboarding details have been submitted successfully. The HR team will review your submission.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="bg-white rounded-xl p-4 w-fit mx-auto shadow-sm">
            <img src={rmplLogo} alt="Logo" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{form.title}</h1>
          {form.description && <p className="text-muted-foreground">{form.description}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Details</CardTitle>
              <CardDescription>Fill in your personal information</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Full Name *</Label>
                <Input value={formData.full_name} onChange={e => updateField("full_name", e.target.value)} placeholder="Enter your full name" />
                {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={v => updateField("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={formData.date_of_birth} onChange={e => updateField("date_of_birth", e.target.value)} />
              </div>
              <div>
                <Label>Marital Status</Label>
                <Select value={formData.marital_status} onValueChange={v => updateField("marital_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{MARITAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Blood Group</Label>
                <Select value={formData.blood_group} onValueChange={v => updateField("blood_group", v)}>
                  <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                  <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qualifications</Label>
                <Input value={formData.qualifications} onChange={e => updateField("qualifications", e.target.value)} placeholder="e.g., B.Tech, MBA" />
              </div>
              <div>
                <Label>Father's Name</Label>
                <Input value={formData.father_name} onChange={e => updateField("father_name", e.target.value)} />
              </div>
              <div>
                <Label>Mother's Name</Label>
                <Input value={formData.mother_name} onChange={e => updateField("mother_name", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Contact & Verification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact & Verification</CardTitle>
              <CardDescription>Verify your phone number and email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Contact Number (Self) *</Label>
                <Input value={formData.contact_number} onChange={e => updateField("contact_number", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} />
                {errors.contact_number && <p className="text-xs text-destructive mt-1">{errors.contact_number}</p>}
              </div>
              <div>
                <Label>Personal Email *</Label>
                <Input type="email" value={formData.personal_email} onChange={e => updateField("personal_email", e.target.value)} placeholder="your.email@example.com" />
                {errors.personal_email && <p className="text-xs text-destructive mt-1">{errors.personal_email}</p>}
                <div className="mt-2">
                  <OtpVerificationInput contact={formData.personal_email} type="email" onVerified={() => setEmailVerified(true)} verified={emailVerified} disabled={!formData.personal_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)} />
                </div>
              </div>
              <div>
                <Label>Emergency Contact Number</Label>
                <Input value={formData.emergency_contact_number} onChange={e => updateField("emergency_contact_number", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" maxLength={10} />
                {errors.emergency_contact_number && <p className="text-xs text-destructive mt-1">{errors.emergency_contact_number}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Identity & Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identity & Address</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>PAN Number</Label>
                <Input value={formData.pan_number} onChange={e => updateField("pan_number", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                {errors.pan_number && <p className="text-xs text-destructive mt-1">{errors.pan_number}</p>}
              </div>
              <div>
                <Label>Aadhaar Number</Label>
                <Input value={formData.aadhar_number} onChange={e => updateField("aadhar_number", e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="12-digit Aadhaar number" maxLength={12} />
                {errors.aadhar_number && <p className="text-xs text-destructive mt-1">{errors.aadhar_number}</p>}
              </div>
              <div>
                <Label>UAN Number</Label>
                <Input value={formData.uan_number} onChange={e => updateField("uan_number", e.target.value)} placeholder="Universal Account Number" />
              </div>
              <div className="md:col-span-2">
                <Label>Present Address</Label>
                <Textarea value={formData.present_address} onChange={e => updateField("present_address", e.target.value)} placeholder="Current residential address" rows={2} />
              </div>
              <div className="md:col-span-2">
                <Label>Permanent Address</Label>
                <Textarea value={formData.permanent_address} onChange={e => updateField("permanent_address", e.target.value)} placeholder="Permanent address" rows={2} />
              </div>
            </CardContent>
          </Card>


          {/* Document Uploads */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Uploads</CardTitle>
              <CardDescription>Upload required documents (PDF, JPG, PNG)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.keys(DOC_LABELS) as DocType[]).map(docType => (
                <div key={docType} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{DOC_LABELS[docType]}</p>
                      {documents[docType] && (
                        <p className="text-xs text-muted-foreground">{documents[docType]!.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {documents[docType] && <CheckCircle className="h-4 w-4 text-green-500" />}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) setDocuments(prev => ({ ...prev, [docType]: file }));
                        }}
                      />
                      <span className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <Upload className="h-3 w-3" />
                        {documents[docType] ? "Change" : "Upload"}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Onboarding Form
          </Button>
        </form>
      </div>
    </div>
  );
}
