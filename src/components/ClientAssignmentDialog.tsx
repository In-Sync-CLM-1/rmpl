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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ClientAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onAssignmentComplete: () => void;
}

type AssignField = "assigned_to" | "managed_by";

export function ClientAssignmentDialog({
  open,
  onOpenChange,
  selectedIds,
  onAssignmentComplete,
}: ClientAssignmentDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [assignField, setAssignField] = useState<AssignField>("assigned_to");
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch all users
  const { data: allUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ["users-for-client-assignment"],
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

  // Fetch CSBD members
  const { data: csbdMembers, isLoading: loadingCsbd } = useQuery({
    queryKey: ["csbd-members-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, full_name)")
        .eq("role", "csbd");
      if (error) throw error;
      return (data || [])
        .map((r: any) => ({ id: r.profiles?.id, full_name: r.profiles?.full_name }))
        .filter((m: any) => m.id && m.full_name)
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    },
    enabled: open,
  });

  const users = assignField === "managed_by" ? csbdMembers : allUsers;
  const isLoadingUsers = assignField === "managed_by" ? loadingCsbd : loadingUsers;

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to assign to");
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

      const { data: result, error: rpcError } = await supabase.rpc("assign_client_records", {
        p_user_id: selectedUserId,
        p_assigned_by: userData.user.id,
        p_field: assignField,
        p_record_ids: selectedIds,
      });

      if (rpcError) {
        console.error("Assignment error:", rpcError);
        toast.error(rpcError.message || "Failed to assign clients");
        setIsAssigning(false);
        return;
      }

      const { successCount, message } = result as any;
      toast.success(message || `Successfully assigned ${successCount} client(s)`);

      onAssignmentComplete();
      onOpenChange(false);
      setSelectedUserId("");
      setAssignField("assigned_to");
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to assign clients");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Selected Clients</DialogTitle>
          <DialogDescription>
            Assign {selectedIds.length} selected client(s) to a user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Assignment type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Assignment Type</Label>
            <RadioGroup
              value={assignField}
              onValueChange={(v) => {
                setAssignField(v as AssignField);
                setSelectedUserId("");
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="assigned_to" id="at" />
                <Label htmlFor="at" className="font-normal cursor-pointer">Assigned To</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="managed_by" id="mb" />
                <Label htmlFor="mb" className="font-normal cursor-pointer">Managed By (CSBD)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* User Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {assignField === "managed_by" ? "Select CSBD Member:" : "Select User:"}
            </Label>
            {isLoadingUsers ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={assignField === "managed_by" ? "Select CSBD member" : "Select a user"} />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user: any) => (
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
            disabled={!selectedUserId || isAssigning || isLoadingUsers}
          >
            {isAssigning ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedIds.length} Client(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
