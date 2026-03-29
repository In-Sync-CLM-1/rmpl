import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, Trash2, FileText, ChevronDown, Plus } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { QuotationPaymentManager } from "./QuotationPaymentManager";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface InvoiceViewDialogProps {
  quotation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (filePath: string, fileName: string) => void;
  onDelete: (quotation: any) => void;
  isDeleting?: boolean;
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

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

export function InvoiceViewDialog({ 
  quotation, 
  open, 
  onOpenChange, 
  onDownload, 
  onDelete,
  isDeleting 
}: InvoiceViewDialogProps) {
  const [showPayments, setShowPayments] = useState(false);

  if (!quotation) return null;

  const paidAmount = Number(quotation.paid_amount) || 0;
  const totalAmount = Number(quotation.amount) || 0;
  const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const isPaidInFull = totalAmount > 0 && paidAmount >= totalAmount;
  const aging = !isPaidInFull ? getPaymentAging(quotation.invoice_date) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-destructive" />
            Invoice Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Info */}
          <div className="space-y-2">
            <p className="font-medium text-sm">{quotation.file_name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {quotation.client?.company_name && (
                <>
                  <span className="font-medium text-foreground">{quotation.client.company_name}</span>
                  <span>•</span>
                </>
              )}
              <span>{formatFileSize(quotation.file_size)}</span>
              <span>•</span>
              <span>
                {quotation.invoice_date 
                  ? format(new Date(quotation.invoice_date), "MMM dd, yyyy")
                  : format(new Date(quotation.created_at), "MMM dd, yyyy")
                }
              </span>
            </div>
          </div>

          {/* Amount & Progress */}
          {totalAmount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">₹{totalAmount.toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  {aging && (
                    <Badge className={`${aging.color} text-white`}>
                      {aging.label} ({aging.days}d)
                    </Badge>
                  )}
                  <Badge variant={isPaidInFull ? "default" : paidAmount > 0 ? "secondary" : "outline"}>
                    {isPaidInFull ? "Paid" : paidAmount > 0 ? `${Math.round(paymentProgress)}% Paid` : "Pending"}
                  </Badge>
                </div>
              </div>
              <Progress value={paymentProgress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>₹{paidAmount.toLocaleString()} received</span>
                {!isPaidInFull && (
                  <span>₹{(totalAmount - paidAmount).toLocaleString()} remaining</span>
                )}
              </div>
            </div>
          )}

          {totalAmount === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No amount set - payment tracking disabled
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(quotation.file_path, quotation.file_name)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {quotation.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(quotation)}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>

          {/* Payments Section */}
          {totalAmount > 0 && (
            <Collapsible open={showPayments} onOpenChange={setShowPayments}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {showPayments ? "Hide Payments" : "Manage Payments"}
                  <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showPayments ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <QuotationPaymentManager
                  quotationId={quotation.id}
                  quotationAmount={totalAmount}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
