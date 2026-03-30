import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, FileText, Loader2, Sparkles, Eye, Plus } from "lucide-react";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { ProjectInvoiceSummary } from "./ProjectInvoiceSummary";
import { useParseInvoice } from "@/hooks/useParseInvoice";
import { InvoiceViewDialog } from "./InvoiceViewDialog";

interface ProjectInvoiceManagerProps {
  projectId: string;
}

type ParseState = "idle" | "parsing" | "parsed" | "error";

interface ParsedData {
  client_name: string; // Display-only from invoice parsing; stored as client_id FK
  invoice_amount: string;
  invoice_date: string;
  raw_amount_text: string;
}

function getPaymentAging(invoiceDate: string | null): { label: string; color: string; days: number } | null {
  if (!invoiceDate) return null;
  
  const days = differenceInDays(new Date(), new Date(invoiceDate));
  
  if (days <= 30) {
    return { label: "Current", color: "bg-green-500", days };
  } else if (days <= 60) {
    return { label: "Overdue", color: "bg-yellow-500", days };
  } else if (days <= 90) {
    return { label: "Seriously Overdue", color: "bg-orange-500", days };
  } else {
    return { label: "Critical", color: "bg-destructive", days };
  }
}

// Sanitize filename for storage paths - removes special characters that Supabase Storage doesn't allow
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/['"&,]/g, '')           // Remove apostrophes, quotes, ampersands, commas
    .replace(/\s+/g, '_')              // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace any other special chars with underscore
    .replace(/_+/g, '_')               // Collapse multiple underscores
    .replace(/^_|_$/g, '');            // Trim leading/trailing underscores
}

export function ProjectInvoiceManager({ projectId }: ProjectInvoiceManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { parseInvoice, isParsing, parseError } = useParseInvoice();
  
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [parsedData, setParsedData] = useState<ParsedData>({
    client_name: "",
    invoice_amount: "",
    invoice_date: "",
    raw_amount_text: "",
  });
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [quickPaymentQuotation, setQuickPaymentQuotation] = useState<any>(null);

  // Fetch quotations with payment totals
  const { data: quotations, isLoading } = useQuery({
    queryKey: ["project-invoices", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_quotations")
        .select("*, client:clients!project_quotations_client_id_fkey(company_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate summary totals
  const totalInvoiced = quotations?.reduce((sum, q) => sum + (Number(q.amount) || 0), 0) || 0;
  const totalReceived = quotations?.reduce((sum, q) => sum + (Number(q.paid_amount) || 0), 0) || 0;
  const totalPending = totalInvoiced - totalReceived;

  // Upload invoice mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, amount, clientName, invoiceDate }: {
      file: File;
      amount: number;
      clientName: string;
      invoiceDate: string;
    }) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("Not authenticated");

      if (file.type !== "application/pdf") {
        throw new Error("Only PDF files are allowed");
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("File size must be less than 10MB");
      }

      // Resolve client_id from the project's client association
      // projects.client_id is TEXT and may contain a UUID or a company name
      let clientId: string | null = null;
      const { data: proj } = await supabase
        .from("projects")
        .select("client_id")
        .eq("id", projectId)
        .single();
      if (proj?.client_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(proj.client_id)) {
          clientId = proj.client_id;
        } else {
          // client_id is a name, not a UUID — look up in clients table
          const { data: client } = await supabase
            .from("clients")
            .select("id")
            .ilike("company_name", proj.client_id.trim())
            .limit(1)
            .single();
          if (client) {
            clientId = client.id;
          }
        }
      }

      const quotationNumber = `QT-${Date.now()}`;
      const sanitizedName = sanitizeFilename(file.name);
      const filePath = `${projectId}/${quotationNumber}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-quotations")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

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
          amount: amount || null,
          client_id: clientId,
          invoice_date: invoiceDate || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
      toast({
        title: "Invoice uploaded",
        description: "Invoice uploaded and parsed successfully",
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setUploadingFile(null);
    setParseState("idle");
    setParsedData({ client_name: "", invoice_amount: "", invoice_date: "", raw_amount_text: "" });
  };

  // Download invoice
  const downloadInvoice = async (filePath: string, fileName: string) => {
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
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Delete invoice mutation
  const deleteMutation = useMutation({
    mutationFn: async (quotation: any) => {
      const { error: storageError } = await supabase.storage
        .from("project-quotations")
        .remove([quotation.file_path]);

      if (storageError) throw storageError;

      const { error } = await supabase
        .from("project_quotations")
        .delete()
        .eq("id", quotation.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-invoices", projectId] });
      toast({
        title: "Invoice deleted",
        description: "Invoice deleted successfully",
      });
      setViewDialogOpen(false);
      setSelectedQuotation(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setUploadingFile(file);
    setParseState("parsing");

    // Upload to temp folder within project folder for parsing
    const sanitizedName = sanitizeFilename(file.name);
    const tempPath = `${projectId}/temp_${Date.now()}_${sanitizedName}`;
    const { error: uploadError } = await supabase.storage
      .from("project-quotations")
      .upload(tempPath, file);

    if (uploadError) {
      console.error("Temp upload error:", uploadError);
      setParseState("error");
      toast({
        title: "Upload Error",
        description: "Failed to upload file for parsing",
        variant: "destructive",
      });
      return;
    }

    // Get public URL for parsing
    const { data: urlData } = supabase.storage
      .from("project-quotations")
      .getPublicUrl(tempPath);

    const result = await parseInvoice(urlData.publicUrl);

    // Clean up temp file
    await supabase.storage.from("project-quotations").remove([tempPath]);

    if (result) {
      setParsedData({
        client_name: result.client_name || "",
        invoice_amount: result.invoice_amount?.toString() || "",
        invoice_date: result.invoice_date || "",
        raw_amount_text: result.raw_amount_text || "",
      });
      setParseState("parsed");
    } else {
      setParseState("error");
      toast({
        title: "Parsing Failed",
        description: parseError || "Could not extract invoice details. Please enter manually.",
        variant: "destructive",
      });
    }
  };

  const handleUpload = () => {
    if (!uploadingFile) return;
    const amount = parseFloat(parsedData.invoice_amount) || 0;
    uploadMutation.mutate({ 
      file: uploadingFile, 
      amount,
      clientName: parsedData.client_name,
      invoiceDate: parsedData.invoice_date,
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleViewInvoice = (quotation: any) => {
    setSelectedQuotation(quotation);
    setViewDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <ProjectInvoiceSummary
        totalInvoiced={totalInvoiced}
        totalReceived={totalReceived}
        totalPending={totalPending}
      />

      {/* Upload Section */}
      <Card>
        <CardContent className="pt-6">
          <h4 className="font-medium mb-4">Upload Invoice</h4>
          
          {parseState === "idle" && !uploadingFile ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById("invoice-upload")?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Drag and drop a PDF file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                PDF only, maximum file size: 10MB • AI will auto-extract details
              </p>
              <input
                id="invoice-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : parseState === "parsing" || isParsing ? (
            <div className="border rounded-lg p-6 text-center">
              <Loader2 className="mx-auto h-10 w-10 text-primary mb-3 animate-spin" />
              <p className="font-medium text-sm">Parsing invoice with AI...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Extracting client name, amount, and date
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{uploadingFile?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {uploadingFile && formatFileSize(uploadingFile.size)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {parseState === "parsed" && (
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI Parsed
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                  >
                    Change
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name</Label>
                  <Input
                    id="client-name"
                    placeholder="Client name"
                    value={parsedData.client_name}
                    onChange={(e) => setParsedData(prev => ({ ...prev, client_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-amount">Invoice Amount (₹)</Label>
                  <Input
                    id="invoice-amount"
                    type="number"
                    placeholder="Amount"
                    value={parsedData.invoice_amount}
                    onChange={(e) => setParsedData(prev => ({ ...prev, invoice_amount: e.target.value }))}
                  />
                  {parsedData.invoice_amount && (
                    <p className="text-xs font-medium text-primary">
                      = ₹{Number(parsedData.invoice_amount).toLocaleString('en-IN')} ({(Number(parsedData.invoice_amount) / 100000).toFixed(2)} Lacs)
                    </p>
                  )}
                  {parsedData.raw_amount_text && (
                    <p className="text-xs text-muted-foreground">
                      Invoice shows: <span className="font-mono font-medium">{parsedData.raw_amount_text}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-date">Invoice Date</Label>
                  <Input
                    id="invoice-date"
                    type="date"
                    value={parsedData.invoice_date}
                    onChange={(e) => setParsedData(prev => ({ ...prev, invoice_date: e.target.value }))}
                  />
                </div>
              </div>

              {parseState === "error" && (
                <p className="text-xs text-destructive">
                  AI parsing failed. Please enter details manually.
                </p>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="w-full"
              >
                {uploadMutation.isPending ? "Uploading..." : "Save Invoice"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="pt-6">
          <h4 className="font-medium mb-4">Invoices</h4>

          {isLoading && <p className="text-muted-foreground text-sm">Loading invoices...</p>}

          {!isLoading && (!quotations || quotations.length === 0) && (
            <p className="text-center text-muted-foreground text-sm py-4">
              No invoices uploaded yet
            </p>
          )}

          {!isLoading && quotations && quotations.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => {
                    const paidAmount = Number(quotation.paid_amount) || 0;
                    const totalAmount = Number(quotation.amount) || 0;
                    const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
                    const isPaidInFull = totalAmount > 0 && paidAmount >= totalAmount;
                    const aging = !isPaidInFull && totalAmount > 0 ? getPaymentAging(quotation.invoice_date) : null;

                    return (
                      <TableRow key={quotation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-destructive flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[150px]">{quotation.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {quotation.invoice_date 
                                  ? format(new Date(quotation.invoice_date), "MMM dd, yyyy")
                                  : format(new Date(quotation.created_at), "MMM dd, yyyy")
                                }
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{(quotation as any).client?.company_name || "-"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {totalAmount > 0 ? (
                            <span className="font-medium">₹{totalAmount.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {paidAmount > 0 ? (
                            <span className="font-medium text-green-600">₹{paidAmount.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalAmount > 0 && !isPaidInFull ? (
                            <span className="font-medium text-orange-600">₹{(totalAmount - paidAmount).toLocaleString()}</span>
                          ) : totalAmount > 0 && isPaidInFull ? (
                            <span className="text-muted-foreground text-sm">-</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {aging && (
                              <Badge className={`${aging.color} text-white text-xs`}>
                                {aging.label} ({aging.days}d)
                              </Badge>
                            )}
                            {totalAmount > 0 && (
                              <Badge 
                                variant={isPaidInFull ? "default" : paidAmount > 0 ? "secondary" : "outline"}
                                className="text-xs"
                              >
                                {isPaidInFull ? "Paid" : paidAmount > 0 ? `${Math.round(paymentProgress)}%` : "Pending"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleViewInvoice(quotation)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!isPaidInFull && totalAmount > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                onClick={() => setQuickPaymentQuotation(quotation)}
                                title="Add Payment"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => downloadInvoice(quotation.file_path, quotation.file_name)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {quotation.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(quotation)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <InvoiceViewDialog
        quotation={selectedQuotation}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onDownload={downloadInvoice}
        onDelete={(q) => deleteMutation.mutate(q)}
        isDeleting={deleteMutation.isPending}
      />

      {/* Quick Add Payment Dialog */}
      <AddPaymentDialog
        open={!!quickPaymentQuotation}
        onOpenChange={(open) => !open && setQuickPaymentQuotation(null)}
        quotationId={quickPaymentQuotation?.id || ""}
        quotationAmount={Number(quickPaymentQuotation?.amount) || 0}
        paidAmount={Number(quickPaymentQuotation?.paid_amount) || 0}
      />
    </div>
  );
}
