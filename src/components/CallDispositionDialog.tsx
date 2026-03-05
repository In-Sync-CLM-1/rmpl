import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CallDispositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callLogId: string;
  existingDisposition?: {
    disposition: string | null;
    subdisposition: string | null;
    notes: string | null;
  };
}

interface DispositionOption {
  disposition: string;
  subdispositions: string[];
}

export function CallDispositionDialog({
  open,
  onOpenChange,
  callLogId,
  existingDisposition,
}: CallDispositionDialogProps) {
  const [disposition, setDisposition] = useState<string>(existingDisposition?.disposition || "");
  const [subdisposition, setSubdisposition] = useState<string>(existingDisposition?.subdisposition || "");
  const [notes, setNotes] = useState<string>(existingDisposition?.notes || "");
  const queryClient = useQueryClient();

  // Fetch available dispositions
  const { data: dispositions } = useQuery({
    queryKey: ['call-dispositions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_dispositions')
        .select('*')
        .eq('is_active', true)
        .order('disposition');

      if (error) throw error;
      return data as DispositionOption[];
    },
  });

  // Reset subdisposition when disposition changes
  useEffect(() => {
    if (disposition !== existingDisposition?.disposition) {
      setSubdisposition("");
    }
  }, [disposition, existingDisposition]);

  // Get subdispositions for selected disposition
  const selectedDisposition = dispositions?.find((d) => d.disposition === disposition);
  const subdispositionOptions = selectedDisposition?.subdispositions || [];

  // Mutation to save disposition
  const saveDispositionMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('call_logs')
        .update({
          disposition,
          subdisposition,
          notes,
          disposition_set_by: user.id,
          disposition_set_at: new Date().toISOString(),
        })
        .eq('id', callLogId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success("Disposition saved successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error saving disposition:', error);
      toast.error("Failed to save disposition");
    },
  });

  const handleSubmit = () => {
    if (!disposition) {
      toast.error("Please select a disposition");
      return;
    }
    if (!subdisposition) {
      toast.error("Please select a subdisposition");
      return;
    }
    saveDispositionMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingDisposition?.disposition ? "Edit Call Disposition" : "Add Call Disposition"}
          </DialogTitle>
          <DialogDescription>
            Categorize the outcome of this call for better tracking and follow-up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="disposition">Disposition *</Label>
            <Select value={disposition} onValueChange={setDisposition}>
              <SelectTrigger id="disposition" className="bg-background">
                <SelectValue placeholder="Select disposition" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {dispositions?.map((d) => (
                  <SelectItem key={d.disposition} value={d.disposition}>
                    {d.disposition}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {disposition && subdispositionOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subdisposition">Subdisposition *</Label>
              <Select value={subdisposition} onValueChange={setSubdisposition}>
                <SelectTrigger id="subdisposition" className="bg-background">
                  <SelectValue placeholder="Select subdisposition" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {subdispositionOptions.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saveDispositionMutation.isPending}>
            {saveDispositionMutation.isPending ? "Saving..." : "Save Disposition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
