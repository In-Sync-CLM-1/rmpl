import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Upload, Download, Trash2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { QuotationPaymentManager } from "./cashflow/QuotationPaymentManager";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface ProjectQuotationManagerProps {
  projectId: string;
}

export const ProjectQuotationManager = ({ projectId }: ProjectQuotationManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch quotations
  const { data: quotations, isLoading } = useQuery({
    queryKey: ["project-quotations", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_quotations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Upload quotation mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("Not authenticated");

      // Validate file type
      if (file.type !== "application/pdf") {
        throw new Error("Only PDF files are allowed");
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("File size must be less than 10MB");
      }

      const quotationNumber = `QT-${Date.now()}`;
      const filePath = `${projectId}/${quotationNumber}_${file.name}`;

      setUploadProgress(0);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("project-quotations")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from("project_quotations")
        .insert({
          project_id: projectId,
          quotation_number: quotationNumber,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          created_by: user.data.user.id,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-quotations", projectId] });
      toast({
        title: "Success",
        description: "Quotation uploaded successfully",
      });
      setUploadingFile(null);
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingFile(null);
      setUploadProgress(0);
    },
  });

  // Download quotation
  const downloadQuotation = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("project-quotations")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Quotation downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Delete quotation mutation
  const deleteMutation = useMutation({
    mutationFn: async (quotation: any) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("project-quotations")
        .remove([quotation.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error } = await supabase
        .from("project_quotations")
        .delete()
        .eq("id", quotation.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-quotations", projectId] });
      toast({
        title: "Success",
        description: "Quotation deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingFile(file);
      uploadMutation.mutate(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setUploadingFile(file);
      uploadMutation.mutate(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    return status === "sent" ? (
      <Badge variant="default">Sent</Badge>
    ) : (
      <Badge variant="secondary">Draft</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Quotation</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              {uploadingFile
                ? `Uploading ${uploadingFile.name}...`
                : "Drag and drop a PDF file here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF only, maximum file size: 10MB
            </p>
            <input
              id="file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploadMutation.isPending}
            />
          </div>

          {uploadMutation.isPending && (
            <div className="mt-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300 animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center mt-2">Uploading...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotations List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Uploaded Quotations</h3>

        {isLoading && <p className="text-muted-foreground">Loading quotations...</p>}

        {!isLoading && (!quotations || quotations.length === 0) && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No quotations uploaded yet</p>
            </CardContent>
          </Card>
        )}

        {quotations?.map((quotation) => {
          const paidAmount = Number(quotation.paid_amount) || 0;
          const totalAmount = Number(quotation.amount) || 0;
          const hasPendingPayment = totalAmount > 0 && paidAmount < totalAmount;
          
          return (
            <Collapsible key={quotation.id}>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-10 w-10 text-destructive" />
                      <div>
                        <p className="font-medium">{quotation.file_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatFileSize(quotation.file_size)}</span>
                          <span>•</span>
                          <span>{format(new Date(quotation.created_at), "MMM dd, yyyy")}</span>
                          {totalAmount > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-medium">₹{totalAmount.toLocaleString()}</span>
                              {paidAmount > 0 && (
                                <Badge variant={hasPendingPayment ? "secondary" : "default"} className="text-xs">
                                  {hasPendingPayment ? `₹${paidAmount.toLocaleString()} paid` : "Paid"}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQuotation(quotation.file_path, quotation.file_name)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>

                      {quotation.status === "draft" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(quotation)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}

                      {totalAmount > 0 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                  </div>

                  {totalAmount > 0 && (
                    <CollapsibleContent>
                      <QuotationPaymentManager
                        quotationId={quotation.id}
                        quotationAmount={totalAmount}
                      />
                    </CollapsibleContent>
                  )}
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};
