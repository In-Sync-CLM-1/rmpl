import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface DemandComAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onAssignmentComplete: () => void;
}

export function DemandComAssignmentDialog({
  open,
  onOpenChange,
  selectedIds,
  onAssignmentComplete,
}: DemandComAssignmentDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch list of users
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["users-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to assign records to");
      return;
    }

    setIsAssigning(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Authentication required");
        setIsAssigning(false);
        return;
      }

      const { data: result, error: rpcError } = await supabase.rpc("assign_demandcom_records", {
        p_assigned_to: selectedUserId,
        p_assigned_by: userData.user.id,
        p_record_ids: selectedIds,
      });

      if (rpcError) {
        console.error("Assignment error:", rpcError);
        toast.error(rpcError.message || "Failed to assign records");
        setIsAssigning(false);
        return;
      }

      const { successCount, message, assigneeName } = result as any;

      toast.success(message || `Successfully assigned ${successCount} records to ${assigneeName}`);
      
      onAssignmentComplete();
      onOpenChange(false);
      setSelectedUserId("");
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to assign records");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Selected Records</DialogTitle>
          <DialogDescription>
            You are about to assign {selectedIds.length} selected record(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">

          {/* User Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Assign To:</label>
            {loadingUsers ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedUserId || isAssigning || loadingUsers}
          >
            {isAssigning ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedIds.length} Records`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
