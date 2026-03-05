import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useVapiBulkCall } from "@/hooks/useVapiCalls";

interface BulkContact {
  phone_number: string;
  contact_name?: string;
  demandcom_id?: string;
}

interface VapiBulkCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: BulkContact[];
}

export function VapiBulkCallDialog({
  open,
  onOpenChange,
  contacts,
}: VapiBulkCallDialogProps) {
  const bulkCall = useVapiBulkCall();
  const [results, setResults] = useState<
    { success: boolean; phone: string; error?: string }[] | null
  >(null);

  const handleStart = () => {
    setResults(null);
    bulkCall.mutate(contacts, {
      onSuccess: (data) => setResults(data),
    });
  };

  const handleClose = () => {
    if (!bulkCall.isPending) {
      setResults(null);
      onOpenChange(false);
    }
  };

  const succeeded = results?.filter((r) => r.success).length || 0;
  const failed = results?.filter((r) => !r.success).length || 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Bulk VAPI Calls
          </DialogTitle>
          <DialogDescription>
            Initiate automated calls to {contacts.length} selected contact(s).
            Calls will be made sequentially with a 2-second delay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm">
            <strong>Contacts:</strong>
            <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
              {contacts.map((c, i) => (
                <div key={i} className="text-muted-foreground text-xs">
                  {c.contact_name || c.phone_number} — {c.phone_number}
                </div>
              ))}
            </div>
          </div>

          {bulkCall.isPending && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Calls in progress...</p>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {results && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Badge variant="default">{succeeded} succeeded</Badge>
                {failed > 0 && (
                  <Badge variant="destructive">{failed} failed</Badge>
                )}
              </div>
              {results
                .filter((r) => !r.success)
                .map((r, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {r.phone}: {r.error}
                  </p>
                ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={bulkCall.isPending}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button onClick={handleStart} disabled={bulkCall.isPending}>
              {bulkCall.isPending ? "Calling..." : "Start Calls"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
