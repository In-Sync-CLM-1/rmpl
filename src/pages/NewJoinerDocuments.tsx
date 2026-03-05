import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { DocumentUploadSection } from "@/components/profile/DocumentUploadSection";

const REQUIRED_DOCUMENTS = [
  { value: "aadhar", label: "Aadhar Card", required: true },
  { value: "pan", label: "PAN Card", required: true },
  { value: "photo", label: "Passport Photo", required: true },
  { value: "education_certificate", label: "Education Certificate", required: true },
  { value: "experience_letter", label: "Experience Letter", required: false },
  { value: "relieving_letter", label: "Relieving Letter", required: false },
  { value: "payslip", label: "Last 3 Payslips", required: false },
  { value: "bank_statement", label: "Bank Statement", required: true },
  { value: "address_proof", label: "Address Proof", required: true },
];

export default function NewJoinerDocuments() {
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["employee-documents", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const uploadedTypes = documents?.map(d => d.document_type) || [];
  const requiredDocs = REQUIRED_DOCUMENTS.filter(d => d.required);
  const uploadedRequired = requiredDocs.filter(d => uploadedTypes.includes(d.value));
  const progress = requiredDocs.length > 0 
    ? Math.round((uploadedRequired.length / requiredDocs.length) * 100) 
    : 0;

  const getDocStatus = (docType: string) => {
    const doc = documents?.find(d => d.document_type === docType);
    if (!doc) return "missing";
    if (doc.verified_at) return "verified";
    return "pending";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Joiner Document Upload</h1>
        <p className="text-muted-foreground">
          Welcome! Please upload the required documents to complete your onboarding
        </p>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Document Submission Progress</span>
            <Badge variant={progress === 100 ? "default" : "secondary"}>
              {progress}% Complete
            </Badge>
          </CardTitle>
          <CardDescription>
            {uploadedRequired.length} of {requiredDocs.length} required documents uploaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3" />
          {progress === 100 ? (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              All required documents uploaded! HR will verify them shortly.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Please upload all required documents marked with *
            </p>
          )}
        </CardContent>
      </Card>

      {/* Document Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Checklist
          </CardTitle>
          <CardDescription>
            Track your document upload status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REQUIRED_DOCUMENTS.map((doc) => {
              const status = getDocStatus(doc.value);
              return (
                <div
                  key={doc.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    status === "verified"
                      ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                      : status === "pending"
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                      : "bg-muted/30"
                  }`}
                >
                  {status === "verified" ? (
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  ) : status === "pending" ? (
                    <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {doc.label}
                      {doc.required && <span className="text-destructive ml-1">*</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status === "verified"
                        ? "Verified"
                        : status === "pending"
                        ? "Pending verification"
                        : "Not uploaded"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <DocumentUploadSection />
    </div>
  );
}
