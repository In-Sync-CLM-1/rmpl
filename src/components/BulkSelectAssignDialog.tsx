import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface BulkSelectAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalCount: number;
  itemsPerPage: number;
  appliedFilters: {
    nameEmail: string;
    city: string;
    activityName: string;
    assignedTo: string;
    disposition: string[];
    subdisposition: string[];
  };
  onAssignmentComplete: () => void;
}

type SelectionType = "all" | "first_n" | "range" | "pages";

export function BulkSelectAssignDialog({
  open,
  onOpenChange,
  totalCount,
  itemsPerPage,
  appliedFilters,
  onAssignmentComplete,
}: BulkSelectAssignDialogProps) {
  const [selectionType, setSelectionType] = useState<SelectionType>("all");
  const [firstN, setFirstN] = useState<number>(100);
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(100);
  const [pageFrom, setPageFrom] = useState<number>(1);
  const [pageTo, setPageTo] = useState<number>(1);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Fetch users for assignment
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["profiles-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectionType("all");
      setFirstN(100);
      setRangeFrom(1);
      setRangeTo(Math.min(100, totalCount));
      setPageFrom(1);
      setPageTo(Math.min(10, totalPages));
      setSelectedUserId("");
    }
  }, [open, totalCount, totalPages]);

  // Calculate selected count based on selection type
  const getSelectedCount = (): number => {
    switch (selectionType) {
      case "all":
        return totalCount;
      case "first_n":
        return Math.min(firstN, totalCount);
      case "range":
        const from = Math.max(1, rangeFrom);
        const to = Math.min(rangeTo, totalCount);
        return Math.max(0, to - from + 1);
      case "pages":
        const startRecord = (Math.max(1, pageFrom) - 1) * itemsPerPage + 1;
        const endRecord = Math.min(pageTo, totalPages) * itemsPerPage;
        return Math.min(endRecord, totalCount) - startRecord + 1;
      default:
        return 0;
    }
  };

  const selectedCount = getSelectedCount();

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to assign records to");
      return;
    }

    if (selectedCount === 0) {
      toast.error("No records to assign");
      return;
    }

    try {
      setIsAssigning(true);

      // Calculate offset and limit based on selection type
      let offset = 0;
      let limit = totalCount;

      switch (selectionType) {
        case "all":
          offset = 0;
          limit = totalCount;
          break;
        case "first_n":
          offset = 0;
          limit = Math.min(firstN, totalCount);
          break;
        case "range":
          offset = Math.max(0, rangeFrom - 1);
          limit = Math.min(rangeTo, totalCount) - offset;
          break;
        case "pages":
          offset = (Math.max(1, pageFrom) - 1) * itemsPerPage;
          const endRecord = Math.min(pageTo, totalPages) * itemsPerPage;
          limit = Math.min(endRecord, totalCount) - offset;
          break;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Authentication required");

      const { data, error } = await supabase.rpc("assign_demandcom_records", {
        p_assigned_to: selectedUserId,
        p_assigned_by: userData.user.id,
        p_offset: offset,
        p_limit: limit,
        p_name_email: appliedFilters.nameEmail || null,
        p_city: appliedFilters.city || null,
        p_activity_name: appliedFilters.activityName || null,
        p_assigned_filter: appliedFilters.assignedTo || null,
        p_disposition: appliedFilters.disposition.length > 0 ? appliedFilters.disposition : null,
        p_subdisposition: appliedFilters.subdisposition.length > 0 ? appliedFilters.subdisposition : null,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message || `Successfully assigned ${result.successCount} records`);
      onAssignmentComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Bulk assign error:", error);
      toast.error(error.message || "Failed to assign records");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Select & Assign
          </DialogTitle>
          <DialogDescription>
            Select records from your filtered data and assign them to a user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Total count info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <span className="font-medium">Total filtered records:</span>{" "}
            <span className="text-primary font-bold">{totalCount.toLocaleString()}</span>
          </div>

          {/* Selection type */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Select Records</Label>
            <RadioGroup
              value={selectionType}
              onValueChange={(value) => setSelectionType(value as SelectionType)}
              className="space-y-4"
            >
              {/* Option 1: All data */}
              <div 
                className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectionType("all")}
              >
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal cursor-pointer flex-1">
                  All filtered data ({totalCount.toLocaleString()} records)
                </Label>
              </div>

              {/* Option 2: First N records */}
              <div 
                className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectionType("first_n")}
              >
                <RadioGroupItem value="first_n" id="first_n" />
                <Label htmlFor="first_n" className="font-normal cursor-pointer flex items-center gap-2 flex-1">
                  First
                  <Input
                    type="number"
                    value={firstN}
                    onChange={(e) => setFirstN(Math.max(1, parseInt(e.target.value) || 1))}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectionType("first_n");
                    }}
                    className="w-20 h-8"
                    min={1}
                    max={totalCount}
                  />
                  records
                </Label>
              </div>

              {/* Option 3: By Page Range */}
              <div 
                className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectionType("pages")}
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="pages" id="pages" />
                  <Label htmlFor="pages" className="font-normal cursor-pointer">
                    By page range
                    <span className="text-xs text-muted-foreground ml-2">({totalPages} pages total)</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-7">
                  <span className="text-sm text-muted-foreground">Page</span>
                  <Input
                    type="number"
                    value={pageFrom}
                    onChange={(e) => setPageFrom(Math.max(1, parseInt(e.target.value) || 1))}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectionType("pages");
                    }}
                    className="w-20 h-8"
                    min={1}
                    max={totalPages}
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="number"
                    value={pageTo}
                    onChange={(e) => setPageTo(Math.max(1, parseInt(e.target.value) || 1))}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectionType("pages");
                    }}
                    className="w-20 h-8"
                    min={1}
                    max={totalPages}
                  />
                  <span className="text-xs text-muted-foreground">({itemsPerPage}/page)</span>
                </div>
              </div>

              {/* Option 4: Record range */}
              <div 
                className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectionType("range")}
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="range" id="range" />
                  <Label htmlFor="range" className="font-normal cursor-pointer">
                    Record range
                  </Label>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-7">
                  <span className="text-sm text-muted-foreground">From</span>
                  <Input
                    type="number"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(Math.max(1, parseInt(e.target.value) || 1))}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectionType("range");
                    }}
                    className="w-20 h-8"
                    min={1}
                    max={totalCount}
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="number"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(Math.max(1, parseInt(e.target.value) || 1))}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectionType("range");
                    }}
                    className="w-20 h-8"
                    min={1}
                    max={totalCount}
                  />
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* User selection */}
          <div className="space-y-2">
            <Label htmlFor="assignee">Assign To</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || "Unknown User"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected count summary */}
          <div className="bg-primary/10 rounded-lg p-3 text-sm text-center">
            <span className="font-medium">Records to assign:</span>{" "}
            <span className="text-primary font-bold text-lg">{selectedCount.toLocaleString()}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedUserId || selectedCount === 0 || isAssigning || usersLoading}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedCount.toLocaleString()} Records`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
