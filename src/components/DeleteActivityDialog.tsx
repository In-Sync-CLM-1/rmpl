import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { AlertTriangle, ChevronsUpDown, Check, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeleteProgressDialog } from "./DeleteProgressDialog";

interface ActivityWithCount {
  activity_name: string;
  count: number;
}

interface DeleteActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteActivityDialog({
  open,
  onOpenChange,
  onSuccess,
}: DeleteActivityDialogProps) {
  const [activities, setActivities] = useState<ActivityWithCount[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  
  // Progress tracking state
  const [showProgress, setShowProgress] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      fetchActivitiesWithCounts();
      setSelectedActivity("");
      setConfirmationText("");
      setShowProgress(false);
      setDeletedCount(0);
      setIsCompleted(false);
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [open]);

  const fetchActivitiesWithCounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_activity_names_with_counts');

      if (error) throw error;

      const activitiesWithCounts: ActivityWithCount[] = (data || []).map(
        (item: { activity_name: string; count: number }) => ({
          activity_name: item.activity_name,
          count: Number(item.count),
        })
      );

      setActivities(activitiesWithCounts);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast.error("Failed to load activities");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedActivityData = activities.find(
    (a) => a.activity_name === selectedActivity
  );

  const canDelete =
    selectedActivity &&
    confirmationText.toLowerCase() === selectedActivity.toLowerCase();

  // Store activity name for polling reference
  const activityNameRef = useRef<string>("");
  const initialTotalRef = useRef<number>(0);

  // Poll for remaining records to track progress
  const startPolling = (activityName: string, initialTotal: number) => {
    setEstimatedTotal(initialTotal);
    activityNameRef.current = activityName;
    initialTotalRef.current = initialTotal;
    
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    const pollFn = async () => {
      try {
        const { count, error } = await supabase
          .from('demandcom')
          .select('*', { count: 'exact', head: true })
          .eq('activity_name', activityNameRef.current);
        
        if (error) {
          console.error('Polling error:', error);
          return;
        }
        
        const remaining = count ?? 0;
        const deleted = initialTotalRef.current - remaining;
        
        console.log(`Delete progress: ${deleted} deleted, ${remaining} remaining`);
        
        setDeletedCount(Math.max(0, deleted));
        
        // If no more records, deletion is complete
        if (remaining === 0) {
          console.log('Deletion complete!');
          setIsCompleted(true);
          setDeletedCount(initialTotalRef.current);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };
    
    // Poll immediately, then every 2 seconds
    pollFn();
    pollingRef.current = setInterval(pollFn, 2000);
  };

  const handleDelete = async () => {
    if (!canDelete || !selectedActivityData) return;

    setIsDeleting(true);
    const initialTotal = selectedActivityData.count;
    
    try {
      // Close the confirmation dialog and show progress
      onOpenChange(false);
      setShowProgress(true);
      setDeletedCount(0);
      setIsCompleted(false);
      
      // Start polling for progress (use trimmed name)
      const trimmedActivityName = selectedActivity.trim();
      startPolling(trimmedActivityName, initialTotal);
      
      // Invoke the delete function with trimmed activity name
      const { data, error } = await supabase.functions.invoke(
        "delete-demandcom-by-activity",
        {
          body: { activity_name: trimmedActivityName },
        }
      );

      if (error) throw error;

      // If the function returns immediately (small dataset or first batch)
      if (data?.status === 'completed') {
        setIsCompleted(true);
        setDeletedCount(data.successCount || initialTotal);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (data?.successCount) {
        // Update with initial batch count
        setDeletedCount(data.successCount);
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete activity records");
      setShowProgress(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProgressComplete = () => {
    setShowProgress(false);
    toast.success(`Successfully deleted ${deletedCount.toLocaleString()} records`);
    onSuccess?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Activity Records
            </DialogTitle>
            <DialogDescription>
              Permanently delete all DemandCom records for a completed activity.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Activity</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading activities...
                      </span>
                    ) : selectedActivity ? (
                      <span className="truncate">{selectedActivity}</span>
                    ) : (
                      "Select an activity..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search activities..." />
                    <CommandList>
                      <CommandEmpty>No activity found.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-auto">
                        {activities.map((activity) => (
                          <CommandItem
                            key={activity.activity_name}
                            value={activity.activity_name}
                            onSelect={() => {
                              setSelectedActivity(activity.activity_name);
                              setConfirmationText("");
                              setPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedActivity === activity.activity_name
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex-1 truncate">
                              {activity.activity_name}
                            </div>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {activity.count.toLocaleString()} records
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedActivityData && (
              <>
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-destructive">
                        Warning: Destructive Action
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This will permanently delete{" "}
                        <strong>
                          {selectedActivityData.count.toLocaleString()} records
                        </strong>{" "}
                        and all related data (call logs, pipeline entries, campaign
                        recipients).
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Note:</strong> Master data will remain unaffected.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Type <strong>"{selectedActivity}"</strong> to confirm
                  </Label>
                  <Input
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Type the activity name to confirm"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Records
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteProgressDialog
        open={showProgress}
        onOpenChange={setShowProgress}
        title={`Deleting records from "${selectedActivity}"`}
        deletedCount={deletedCount}
        isCompleted={isCompleted}
        estimatedTotal={estimatedTotal}
        onComplete={handleProgressComplete}
      />
    </>
  );
}
