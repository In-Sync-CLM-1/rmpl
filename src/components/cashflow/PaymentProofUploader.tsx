import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useParsePaymentImage, ParsedPaymentData } from "@/hooks/useParsePaymentImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, CheckCircle2, XCircle, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface PaymentProofUploaderProps {
  onParsed: (data: ParsedPaymentData) => void;
}

export function PaymentProofUploader({ onParsed }: PaymentProofUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "parsing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsePaymentImage = useParsePaymentImage();

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const handleUploadAndParse = async () => {
    if (!file) return;

    try {
      setStatus("uploading");
      setUploading(true);

      // Upload to temporary location
      const tempPath = `temp/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(tempPath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(tempPath);

      setStatus("parsing");

      // Parse the image
      const parsedData = await parsePaymentImage.mutateAsync(urlData.publicUrl);

      setStatus("success");
      toast.success("Payment details extracted successfully!");
      onParsed(parsedData);

      // Clean up temp file after a delay
      setTimeout(async () => {
        await supabase.storage.from("payment-proofs").remove([tempPath]);
      }, 5000);

    } catch (error: any) {
      console.error("Error processing image:", error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to process image");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const getStatusIcon = () => {
    switch (status) {
      case "uploading":
      case "parsing":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return "Uploading image...";
      case "parsing":
        return "Extracting payment details with AI...";
      case "success":
        return "Details extracted! Review the form below.";
      case "error":
        return errorMessage || "Failed to process image";
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById("payment-proof-input")?.click()}
              className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Upload payment confirmation</p>
              <p className="text-xs text-muted-foreground mt-1">
                UPI screenshot, bank statement, cheque image, etc.
              </p>
              <p className="text-xs text-muted-foreground">
                Drag & drop or click to browse
              </p>
              <input
                id="payment-proof-input"
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Payment proof preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  {status !== "idle" && (
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusIcon()}
                      <span className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                        {getStatusText()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setStatus("idle");
                    setErrorMessage(null);
                  }}
                  disabled={uploading}
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  onClick={handleUploadAndParse}
                  disabled={uploading || status === "success"}
                >
                  {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {status === "success" ? "Extracted" : "Extract Details"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        AI will extract payment amount, date, reference number, and bank details from the image
      </p>
    </div>
  );
}
