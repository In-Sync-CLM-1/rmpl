import { useState } from "react";
import { FormDialog } from "./forms/FormDialog";
import { FormField } from "./forms/FormField";
import { Textarea } from "./ui/textarea";
import { RefreshCw } from "lucide-react";

interface RestartTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  taskName: string;
}

export function RestartTaskDialog({ 
  open, 
  onOpenChange, 
  onConfirm,
  taskName,
}: RestartTaskDialogProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    
    setIsLoading(true);
    try {
      await onConfirm(reason);
      setReason("");
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setReason("");
        onOpenChange(isOpen);
      }}
      title="Restart Task"
      description={`You are about to restart the task "${taskName}". Please provide a reason for restarting.`}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel="Restart Task"
    >
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          This will change the task status back to "Pending"
        </span>
      </div>

      <FormField label="Restart Reason" htmlFor="restart_reason" required>
        <Textarea
          id="restart_reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for restarting this task..."
          rows={4}
          required
        />
      </FormField>
    </FormDialog>
  );
}
