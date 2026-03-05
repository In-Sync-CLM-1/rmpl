import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useAllocateInventory } from "@/hooks/useInventoryAllocation";
import { format } from "date-fns";

interface AllocationDialogProps {
  item: {
    id: string;
    items: string;
    serial_number: string | null;
    brand: string | null;
    model: string | null;
    line_number?: number | null;
    invoice_no?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function AllocationDialog({ item, isOpen, onClose }: AllocationDialogProps) {
  const [userId, setUserId] = useState("");
  const [allocatedCondition, setAllocatedCondition] = useState("Good");
  const [allocationDate, setAllocationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  const allocateMutation = useAllocateInventory();

  const { data: users } = useQuery({
    queryKey: ["users-for-allocation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      return;
    }

    try {
      await allocateMutation.mutateAsync({
        inventory_item_id: item.id,
        user_id: userId,
        allocated_condition: allocatedCondition,
        allocation_date: allocationDate,
        expected_return_date: expectedReturnDate || undefined,
        allocation_notes: notes || undefined,
      });

      onClose();
      
      // Reset form
      setUserId("");
      setAllocatedCondition("Good");
      setAllocationDate(format(new Date(), "yyyy-MM-dd"));
      setExpectedReturnDate("");
      setNotes("");
    } catch (error) {
      // Error toast is shown by mutation's onError; keep dialog open for retry
      console.error("Allocation failed:", error);
    }
  };

  // Build description with line number if available
  const itemDescription = item.line_number 
    ? `${item.items} (Invoice: ${item.invoice_no} #${item.line_number})`
    : `${item.items} (${item.serial_number || 'No Serial'})`;

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={onClose}
      title="Allocate Item"
      description={`Allocate ${itemDescription} to a user`}
      onSubmit={handleSubmit}
      isLoading={allocateMutation.isPending}
      submitLabel="Allocate"
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="user">User *</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="allocation_date">Allocation Date *</Label>
          <Input
            id="allocation_date"
            type="date"
            value={allocationDate}
            onChange={(e) => setAllocationDate(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="condition">Asset Condition at Handover *</Label>
          <Select value={allocatedCondition} onValueChange={setAllocatedCondition}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Good">Good</SelectItem>
              <SelectItem value="Used">Used</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="expected_return_date">Expected Return Date</Label>
          <Input
            id="expected_return_date"
            type="date"
            value={expectedReturnDate}
            onChange={(e) => setExpectedReturnDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="notes">Comments</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes about this allocation..."
            rows={3}
          />
        </div>
      </div>
    </FormDialog>
  );
}
