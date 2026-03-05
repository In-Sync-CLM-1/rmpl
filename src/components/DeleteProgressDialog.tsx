import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";

interface DeleteProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  deletedCount: number;
  isCompleted: boolean;
  estimatedTotal?: number;
  onComplete?: () => void;
}

export function DeleteProgressDialog({
  open,
  onOpenChange,
  title,
  deletedCount,
  isCompleted,
  estimatedTotal,
  onComplete,
}: DeleteProgressDialogProps) {
  const progressPercent = estimatedTotal 
    ? Math.min(Math.round((deletedCount / estimatedTotal) * 100), 99)
    : 0;
  
  const displayPercent = isCompleted ? 100 : progressPercent;

  const handleClose = () => {
    onOpenChange(false);
    if (isCompleted && onComplete) {
      onComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-destructive" />
            )}
            {isCompleted ? "Deletion Complete" : "Deleting Records..."}
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{displayPercent}%</span>
            </div>
            <Progress 
              value={displayPercent} 
              className="h-3"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Deleted</p>
              <p className="text-3xl font-bold text-destructive">
                {deletedCount.toLocaleString()}
              </p>
            </div>
            {estimatedTotal && (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Total</p>
                <p className="text-3xl font-bold">
                  {estimatedTotal.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Status Message */}
          {!isCompleted && (
            <p className="text-sm text-muted-foreground text-center animate-pulse">
              Processing in batches... Please wait.
            </p>
          )}

          {isCompleted && (
            <p className="text-sm text-green-600 text-center font-medium">
              Successfully deleted {deletedCount.toLocaleString()} records!
            </p>
          )}

          {/* Close Button */}
          <Button onClick={handleClose} className="w-full">
            {isCompleted ? "Close" : "Run in Background"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
