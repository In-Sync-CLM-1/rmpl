import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

interface Disposition {
  id: string;
  disposition: string;
  subdispositions: string[];
  is_active: boolean;
}

interface CallDispositionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disposition: Disposition | null;
  onSuccess: () => void;
}

export function CallDispositionFormDialog({
  open,
  onOpenChange,
  disposition,
  onSuccess,
}: CallDispositionFormDialogProps) {
  const [dispositionName, setDispositionName] = useState("");
  const [subdispositions, setSubdispositions] = useState<string[]>([]);
  const [newSubdisposition, setNewSubdisposition] = useState("");
  const [isActive, setIsActive] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (disposition) {
      setDispositionName(disposition.disposition);
      setSubdispositions(disposition.subdispositions);
      setIsActive(disposition.is_active);
    } else {
      setDispositionName("");
      setSubdispositions([]);
      setNewSubdisposition("");
      setIsActive(true);
    }
  }, [disposition, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (disposition) {
        // Update existing
        const { error } = await supabase
          .from('call_dispositions')
          .update({
            disposition: dispositionName,
            subdispositions,
            is_active: isActive,
          })
          .eq('id', disposition.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('call_dispositions')
          .insert({
            disposition: dispositionName,
            subdispositions,
            is_active: isActive,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-dispositions'] });
      toast.success(disposition ? "Disposition updated" : "Disposition created");
      onSuccess();
    },
    onError: (error) => {
      console.error('Error saving disposition:', error);
      toast.error("Failed to save disposition");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!disposition) return;
      
      const { error } = await supabase
        .from('call_dispositions')
        .delete()
        .eq('id', disposition.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-dispositions'] });
      toast.success("Disposition deleted");
      onSuccess();
    },
    onError: (error) => {
      console.error('Error deleting disposition:', error);
      toast.error("Failed to delete disposition");
    },
  });

  const handleAddSubdisposition = () => {
    if (!newSubdisposition.trim()) return;
    setSubdispositions([...subdispositions, newSubdisposition.trim()]);
    setNewSubdisposition("");
  };

  const handleRemoveSubdisposition = (index: number) => {
    setSubdispositions(subdispositions.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!dispositionName.trim()) {
      toast.error("Disposition name is required");
      return;
    }
    if (subdispositions.length === 0) {
      toast.error("At least one sub-disposition is required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {disposition ? "Edit Disposition" : "Add New Disposition"}
          </DialogTitle>
          <DialogDescription>
            Configure the disposition and its sub-dispositions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="disposition">Disposition Name *</Label>
            <Input
              id="disposition"
              value={dispositionName}
              onChange={(e) => setDispositionName(e.target.value)}
              placeholder="e.g., Connected"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Active</Label>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="space-y-3">
            <Label>Sub-Dispositions *</Label>
            <div className="flex gap-2">
              <Input
                value={newSubdisposition}
                onChange={(e) => setNewSubdisposition(e.target.value)}
                placeholder="Add sub-disposition"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubdisposition();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddSubdisposition}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {subdispositions.map((sub, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm">{sub}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveSubdisposition(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {subdispositions.length > 0 && (
              <Badge variant="outline">
                {subdispositions.length} sub-disposition{subdispositions.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {disposition && (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
