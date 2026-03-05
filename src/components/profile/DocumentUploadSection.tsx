import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Trash2, CheckCircle, Clock, Loader2, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const DOCUMENT_TYPES = [
  { value: "aadhar", label: "Aadhar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "passport", label: "Passport" },
  { value: "education_certificate", label: "Education Certificate" },
  { value: "experience_letter", label: "Experience Letter" },
  { value: "offer_letter", label: "Offer Letter (Previous)" },
  { value: "relieving_letter", label: "Relieving Letter" },
  { value: "payslip", label: "Last 3 Payslips" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "photo", label: "Passport Photo" },
  { value: "address_proof", label: "Address Proof" },
  { value: "other", label: "Other Document" },
];

interface DocumentUploadSectionProps {
  userId?: string;
  isHRView?: boolean;
}

export function DocumentUploadSection({ userId, isHRView = false }: DocumentUploadSectionProps) {
  const [selectedType, setSelectedType] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    enabled: !userId,
  });

  const targetUserId = userId || currentUser?.id;

  const { data: documents, isLoading } = useQuery({
    queryKey: ["employee-documents", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*, verified_by_profile:profiles!employee_documents_verified_by_fkey(full_name)")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("employee-documents")
        .remove([doc.file_path]);
      
      if (storageError) throw storageError;

      // Delete from database
      const { error } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", doc.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete document: " + error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType || !targetUserId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${selectedType}.${fileExt}`;
      const filePath = `${targetUserId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save to database
      const { error: dbError } = await supabase
        .from("employee_documents")
        .insert({
          user_id: targetUserId,
          document_type: selectedType,
          document_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      toast.success("Document uploaded successfully");
      setSelectedType("");
      e.target.value = "";
    } catch (error: any) {
      toast.error("Failed to upload document: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error("Failed to download document: " + error.message);
    }
  };

  const getDocumentTypeLabel = (value: string) => {
    return DOCUMENT_TYPES.find(t => t.value === value)?.label || value;
  };

  const uploadedTypes = documents?.map(d => d.document_type) || [];
  const missingDocs = DOCUMENT_TYPES.filter(
    t => !uploadedTypes.includes(t.value) && t.value !== "other"
  );

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          My Documents
        </CardTitle>
        <CardDescription>
          Upload your identity and employment documents for verification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Missing Documents Warning */}
        {!isHRView && missingDocs.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-600">Missing Documents</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please upload: {missingDocs.slice(0, 3).map(d => d.label).join(", ")}
                  {missingDocs.length > 3 && ` and ${missingDocs.length - 3} more`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Form */}
        {!isHRView && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                      {uploadedTypes.includes(type.value) && " ✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileUpload}
                disabled={!selectedType || uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button disabled={!selectedType || uploading} className="w-full sm:w-auto">
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        )}

        {/* Documents List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {getDocumentTypeLabel(doc.document_type)}
                      </span>
                      {doc.verified_at ? (
                        <Badge variant="default" className="shrink-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.document_name} • {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                    </p>
                    {doc.verified_at && doc.verified_by_profile && (
                      <p className="text-xs text-muted-foreground">
                        Verified by {(doc.verified_by_profile as any).full_name} on{" "}
                        {format(new Date(doc.verified_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc.file_path, doc.document_name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!isHRView && !doc.verified_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate({ id: doc.id, file_path: doc.file_path })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No documents uploaded yet</p>
            {!isHRView && (
              <p className="text-sm mt-1">
                Select a document type and upload your files
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
