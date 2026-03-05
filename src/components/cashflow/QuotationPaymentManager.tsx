import { useState } from "react";
import { useQuotationPayments } from "@/hooks/useQuotationPayments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AddPaymentDialog } from "./AddPaymentDialog";
import {
  Plus,
  Trash2,
  IndianRupee,
  Calendar,
  CreditCard,
  Hash,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuotationPaymentManagerProps {
  quotationId: string;
  quotationAmount: number;
}

export function QuotationPaymentManager({
  quotationId,
  quotationAmount,
}: QuotationPaymentManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const { payments, isLoading, deletePayment, totalPaid } = useQuotationPayments(quotationId);

  const paymentProgress = quotationAmount > 0 ? (totalPaid / quotationAmount) * 100 : 0;
  const remainingAmount = quotationAmount - totalPaid;
  const isPaidInFull = remainingAmount <= 0;

  const getPaymentModeLabel = (mode: string) => {
    const modes: Record<string, string> = {
      upi: "UPI",
      bank_transfer: "Bank Transfer",
      neft: "NEFT",
      rtgs: "RTGS",
      imps: "IMPS",
      cheque: "Cheque",
      cash: "Cash",
      card: "Card",
    };
    return modes[mode] || mode;
  };

  const getStatusBadge = () => {
    if (isPaidInFull) {
      return <Badge className="bg-green-500">Paid</Badge>;
    }
    if (totalPaid > 0) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700">Partial</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  if (isLoading) {
    return <div className="py-4 text-center text-muted-foreground text-sm">Loading payments...</div>;
  }

  return (
    <div className="space-y-4 mt-4 pt-4 border-t">
      {/* Payment Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="font-medium text-sm">Payments</h4>
          {getStatusBadge()}
        </div>
        {!isPaidInFull && (
          <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Payment
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={paymentProgress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            ₹{totalPaid.toLocaleString()} received
          </span>
          <span>
            {isPaidInFull ? (
              <span className="text-green-600">Fully Paid</span>
            ) : (
              <>₹{remainingAmount.toLocaleString()} remaining</>
            )}
          </span>
        </div>
      </div>

      {/* Payments List */}
      {payments && payments.length > 0 && (
        <div className="space-y-2">
          {payments.map((payment) => (
            <Card key={payment.id} className="bg-muted/30">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-green-600" />
                      <span className="font-semibold">
                        ₹{Number(payment.amount).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getPaymentModeLabel(payment.payment_mode)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(payment.payment_date), "dd MMM yyyy")}
                      </span>
                      {payment.reference_number && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {payment.reference_number}
                        </span>
                      )}
                      {payment.bank_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {payment.bank_name}
                        </span>
                      )}
                    </div>
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {payment.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletePaymentId(payment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(!payments || payments.length === 0) && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No payments recorded yet
        </p>
      )}

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        quotationId={quotationId}
        quotationAmount={quotationAmount}
        paidAmount={totalPaid}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePaymentId) {
                  deletePayment.mutate(deletePaymentId);
                  setDeletePaymentId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
