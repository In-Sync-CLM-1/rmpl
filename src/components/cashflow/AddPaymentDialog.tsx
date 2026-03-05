import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentProofUploader } from "./PaymentProofUploader";
import { useQuotationPayments, CreatePaymentData } from "@/hooks/useQuotationPayments";
import { ParsedPaymentData } from "@/hooks/useParsePaymentImage";
import { Loader2, Receipt, Upload } from "lucide-react";
import { format } from "date-fns";

const paymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_mode: z.string().min(1, "Payment mode is required"),
  reference_number: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  quotationAmount: number;
  paidAmount: number;
}

const PAYMENT_MODES = [
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "neft", label: "NEFT" },
  { value: "rtgs", label: "RTGS" },
  { value: "imps", label: "IMPS" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

export function AddPaymentDialog({
  open,
  onOpenChange,
  quotationId,
  quotationAmount,
  paidAmount,
}: AddPaymentDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("manual");
  const { createPayment } = useQuotationPayments(quotationId);
  const remainingAmount = quotationAmount - paidAmount;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: remainingAmount > 0 ? remainingAmount : 0,
      payment_date: format(new Date(), "yyyy-MM-dd"),
      payment_mode: "",
      reference_number: "",
      bank_name: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        amount: remainingAmount > 0 ? remainingAmount : 0,
        payment_date: format(new Date(), "yyyy-MM-dd"),
        payment_mode: "",
        reference_number: "",
        bank_name: "",
        notes: "",
      });
    }
  }, [open, remainingAmount, reset]);

  const handleParsedData = (data: ParsedPaymentData) => {
    if (data.amount) setValue("amount", data.amount);
    if (data.payment_date) setValue("payment_date", data.payment_date);
    if (data.payment_mode) setValue("payment_mode", data.payment_mode);
    if (data.reference_number) setValue("reference_number", data.reference_number);
    if (data.bank_name) setValue("bank_name", data.bank_name);
    setActiveTab("manual"); // Switch to manual tab to show pre-filled form
  };

  const onSubmit = async (data: PaymentFormData) => {
    const paymentData: CreatePaymentData = {
      quotation_id: quotationId,
      amount: data.amount,
      payment_date: data.payment_date,
      payment_mode: data.payment_mode,
      reference_number: data.reference_number || undefined,
      bank_name: data.bank_name || undefined,
      notes: data.notes || undefined,
    };

    await createPayment.mutateAsync(paymentData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Invoice Amount:</span>
            <span className="font-medium">₹{quotationAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Already Paid:</span>
            <span className="font-medium text-green-600">₹{paidAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm border-t mt-2 pt-2">
            <span className="text-muted-foreground">Remaining:</span>
            <span className="font-medium text-orange-600">₹{remainingAmount.toLocaleString()}</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Proof
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <PaymentProofUploader onParsed={handleParsedData} />
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...register("amount", { valueAsNumber: true })}
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_date">Payment Date *</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    {...register("payment_date")}
                  />
                  {errors.payment_date && (
                    <p className="text-sm text-destructive">{errors.payment_date.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_mode">Payment Mode *</Label>
                  <Select
                    value={watch("payment_mode")}
                    onValueChange={(value) => setValue("payment_mode", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.payment_mode && (
                    <p className="text-sm text-destructive">{errors.payment_mode.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank/App Name</Label>
                  <Input
                    id="bank_name"
                    placeholder="e.g., HDFC, Google Pay"
                    {...register("bank_name")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference_number">Reference/UTR Number</Label>
                <Input
                  id="reference_number"
                  placeholder="Transaction reference number"
                  {...register("reference_number")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  rows={2}
                  {...register("notes")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createPayment.isPending}>
                  {createPayment.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Record Payment
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
