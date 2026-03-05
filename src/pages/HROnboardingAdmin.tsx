import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { DocumentAIReview } from "@/components/onboarding/DocumentAIReview";
import { Plus, Copy, ExternalLink, Eye, Brain, Loader2, CheckCircle, XCircle, ToggleLeft, ToggleRight, FileDown } from "lucide-react";
import { format } from "date-fns";

export default function HROnboardingAdmin() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  // Fetch forms
  const { data: forms, isLoading: formsLoading } = useQuery({
    queryKey: ["onboarding-forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch submissions
  const { data: submissions } = useQuery({
    queryKey: ["onboarding-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_submissions")
        .select("*, onboarding_forms(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch documents for selected submission
  const { data: submissionDocs } = useQuery({
    queryKey: ["onboarding-docs", selectedSubmission?.id],
    queryFn: async () => {
      if (!selectedSubmission) return [];
      const { data, error } = await supabase
        .from("onboarding_documents")
        .select("*")
        .eq("submission_id", selectedSubmission.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSubmission,
  });

  const createForm = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const slug = newSlug || newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("onboarding_forms").insert({
        title: newTitle,
        description: newDescription || null,
        slug,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-forms"] });
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewSlug("");
      toast({ title: "Created", description: "Onboarding form created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleFormStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("onboarding_forms").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-forms"] }),
  });

  const updateSubmissionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("onboarding_submissions").update({
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
      toast({ title: "Updated", description: "Submission status updated" });
    },
  });

  const runAIAnalysis = async (submissionId: string) => {
    setAnalyzing(submissionId);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-onboarding-document", {
        body: { submission_id: submissionId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission((prev: any) => prev ? { ...prev, ai_review_result: data.analysis, ai_review_at: new Date().toISOString() } : prev);
      }
      toast({ title: "Analysis Complete", description: `Risk score: ${data.analysis.risk_score}/100` });
    } catch (e: any) {
      toast({ title: "Analysis Failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  const copyLink = (slug: string) => {
    const url = `https://rmpl.in-sync.co.in/onboarding/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link Copied", description: url });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      documents_under_review: { variant: "secondary", label: "Under Review" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
    };
    const s = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("onboarding-documents").download(filePath);
    if (error) { toast({ title: "Download Error", description: error.message, variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Onboarding"
        subtitle="Create and manage onboarding forms for new joiners"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Form</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Onboarding Form</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Feb 2026 Batch" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Optional description" rows={2} />
                </div>
                <div>
                  <Label>URL Slug</Label>
                  <Input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="auto-generated from title" />
                  <p className="text-xs text-muted-foreground mt-1">Leave blank to auto-generate</p>
                </div>
                <Button onClick={() => createForm.mutate()} disabled={!newTitle || createForm.isPending} className="w-full">
                  {createForm.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Form
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Forms List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onboarding Forms</CardTitle>
        </CardHeader>
        <CardContent>
          {formsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !forms?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No forms created yet. Click "New Form" to create one.</p>
          ) : (
            <div className="space-y-3">
              {forms.map(f => (
                <div key={f.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">{f.title}</p>
                    <p className="text-xs text-muted-foreground">/onboarding/{f.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.is_active ? "default" : "secondary"}>{f.is_active ? "Active" : "Inactive"}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => toggleFormStatus.mutate({ id: f.id, is_active: !f.is_active })}>
                      {f.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => copyLink(f.slug)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => window.open(`/onboarding/${f.slug}`, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
          <CardDescription>{submissions?.length || 0} submissions received</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!submissions?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No submissions yet</TableCell></TableRow>
                ) : submissions.map(sub => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.full_name}</TableCell>
                    <TableCell className="text-sm">{sub.personal_email}</TableCell>
                    <TableCell className="text-sm">{sub.contact_number}</TableCell>
                    <TableCell className="text-sm">{(sub as any).onboarding_forms?.title || "-"}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell className="text-sm">{format(new Date(sub.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedSubmission(sub); setReviewOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => runAIAnalysis(sub.id)} disabled={analyzing === sub.id}>
                          {analyzing === sub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Review Sheet */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Submission Review</SheetTitle>
          </SheetHeader>
          {selectedSubmission && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedSubmission.status)}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateSubmissionStatus.mutate({ id: selectedSubmission.id, status: "approved" })}>
                    <CheckCircle className="h-4 w-4 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => updateSubmissionStatus.mutate({ id: selectedSubmission.id, status: "rejected" })}>
                    <XCircle className="h-4 w-4 mr-1" />Reject
                  </Button>
                </div>
              </div>

              {/* Personal Info */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Personal Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Name", selectedSubmission.full_name],
                    ["Gender", selectedSubmission.gender],
                    ["D.O.B.", selectedSubmission.date_of_birth],
                    ["Marital Status", selectedSubmission.marital_status],
                    ["Blood Group", selectedSubmission.blood_group],
                    ["Qualifications", selectedSubmission.qualifications],
                    ["Father's Name", selectedSubmission.father_name],
                    ["Mother's Name", selectedSubmission.mother_name],
                    ["Phone", selectedSubmission.contact_number],
                    ["Email", selectedSubmission.personal_email],
                    ["Emergency Contact", selectedSubmission.emergency_contact_number],
                    ["PAN", selectedSubmission.pan_number],
                    ["Aadhaar", selectedSubmission.aadhar_number],
                    ["UAN", selectedSubmission.uan_number],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{(value as string) || "-"}</p>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Present Address</p>
                    <p className="font-medium">{selectedSubmission.present_address || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Permanent Address</p>
                    <p className="font-medium">{selectedSubmission.permanent_address || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Details */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Bank Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Bank Name", selectedSubmission.bank_name],
                    ["Account No.", selectedSubmission.account_number],
                    ["IFSC Code", selectedSubmission.ifsc_code],
                    ["Branch", selectedSubmission.branch_name],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{(value as string) || "-"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Verification Status */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Verification</CardTitle></CardHeader>
                <CardContent className="flex gap-4">
                  <Badge variant={selectedSubmission.phone_verified ? "default" : "outline"}>
                    {selectedSubmission.phone_verified ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                    Phone {selectedSubmission.phone_verified ? "Verified" : "Not Verified"}
                  </Badge>
                  <Badge variant={selectedSubmission.email_verified ? "default" : "outline"}>
                    {selectedSubmission.email_verified ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                    Email {selectedSubmission.email_verified ? "Verified" : "Not Verified"}
                  </Badge>
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {!submissionDocs?.length ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded</p>
                  ) : submissionDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between border rounded p-2">
                      <div>
                        <p className="text-sm font-medium capitalize">{doc.document_type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => downloadDocument(doc.file_path, doc.file_name)}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* AI Review */}
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => runAIAnalysis(selectedSubmission.id)} disabled={analyzing === selectedSubmission.id}>
                  {analyzing === selectedSubmission.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                  Run AI Document Analysis
                </Button>
                <DocumentAIReview analysis={selectedSubmission.ai_review_result} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
