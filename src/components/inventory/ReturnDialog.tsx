import { useState } from "react";
import { FormDialog } from "@/components/forms/FormDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeallocateInventory, AllocationWithDetails } from "@/hooks/useInventoryAllocation";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface ReturnDialogProps {
  allocation: AllocationWithDetails;
  isOpen: boolean;
  onClose: () => void;
}

export function ReturnDialog({ allocation, isOpen, onClose }: ReturnDialogProps) {
  const [deallocationDate, setDeallocationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [returnedCondition, setReturnedCondition] = useState("Good");
  const [returnNotes, setReturnNotes] = useState("");

  const deallocateMutation = useDeallocateInventory();

  const getStatusPreview = () => {
    switch (returnedCondition) {
      case "Good":
        return { status: "Available", color: "text-green-600" };
      case "Needs Repair":
        return { status: "Damaged", color: "text-yellow-600" };
      case "Damaged":
        return { status: "Retired", color: "text-red-600" };
      default:
        return { status: "Unknown", color: "text-gray-600" };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await deallocateMutation.mutateAsync({
      allocation_id: allocation.id,
      deallocation_date: deallocationDate,
      returned_condition: returnedCondition,
      return_notes: returnNotes || undefined,
    });

    onClose();
    
    // Reset form
    setDeallocationDate(format(new Date(), "yyyy-MM-dd"));
    setReturnedCondition("Good");
    setReturnNotes("");
  };

  const preview = getStatusPreview();

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={onClose}
      title="Process Return"
      description={`Return ${allocation.inventory_item?.items || 'item'} from ${allocation.user?.full_name || 'user'}`}
      onSubmit={handleSubmit}
      isLoading={deallocateMutation.isPending}
      submitLabel="Process Return"
    >
      <div className="space-y-4">
        <div className="p-3 bg-muted rounded-md space-y-1">
          <p className="text-sm"><strong>Item:</strong> {allocation.inventory_item?.items}</p>
          <p className="text-sm"><strong>Serial Number:</strong> {allocation.inventory_item?.serial_number || 'N/A'}</p>
          <p className="text-sm"><strong>Allocated To:</strong> {allocation.user?.full_name || allocation.user?.email}</p>
          <p className="text-sm"><strong>Allocated On:</strong> {format(new Date(allocation.allocation_date), "MMM dd, yyyy")}</p>
          <p className="text-sm"><strong>Condition at Allocation:</strong> {allocation.allocated_condition}</p>
        </div>

        <div>
          <Label htmlFor="deallocation_date">Return Date *</Label>
          <Input
            id="deallocation_date"
            type="date"
            value={deallocationDate}
            onChange={(e) => setDeallocationDate(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="returned_condition">Returned Condition *</Label>
          <Select value={returnedCondition} onValueChange={setReturnedCondition}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Good">Good</SelectItem>
              <SelectItem value="Needs Repair">Needs Repair</SelectItem>
              <SelectItem value="Damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Item status will be updated to: <span className={`font-semibold ${preview.color}`}>{preview.status}</span>
          </AlertDescription>
        </Alert>

        <div>
          <Label htmlFor="return_notes">Return Notes</Label>
          <Textarea
            id="return_notes"
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            placeholder="Any notes about the returned item..."
            rows={3}
          />
        </div>
      </div>
    </FormDialog>
  );
}
