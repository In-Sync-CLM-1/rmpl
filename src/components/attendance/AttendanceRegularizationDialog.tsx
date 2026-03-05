import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { formatTimeShortIST } from "@/lib/dateUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAttendanceRegularization, RegularizationType } from "@/hooks/useAttendanceRegularization";

const REGULARIZATION_TYPES: { value: RegularizationType; label: string }[] = [
  { value: 'forgot_signin', label: 'Forgot to Sign In' },
  { value: 'forgot_signout', label: 'Forgot to Sign Out' },
  { value: 'time_correction', label: 'Time Correction' },
  { value: 'location_issue', label: 'Location Issue' },
  { value: 'other', label: 'Other' },
];

const formSchema = z.object({
  attendance_date: z.date({ required_error: "Date is required" }),
  regularization_type: z.enum(['forgot_signin', 'forgot_signout', 'time_correction', 'location_issue', 'other'] as const),
  requested_sign_in_time: z.string().optional(),
  requested_sign_out_time: z.string().optional(),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

type FormValues = z.infer<typeof formSchema>;

interface AttendanceRegularizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledDate?: string; // yyyy-MM-dd format
}

export function AttendanceRegularizationDialog({ open, onOpenChange, prefilledDate }: AttendanceRegularizationDialogProps) {
  const { createRegularization, getAttendanceForDate } = useAttendanceRegularization();
  const [existingRecord, setExistingRecord] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      regularization_type: 'forgot_signin',
      reason: '',
      attendance_date: prefilledDate ? new Date(prefilledDate) : undefined,
    },
  });

  // Update form when prefilledDate changes
  useEffect(() => {
    if (prefilledDate && open) {
      form.setValue("attendance_date", new Date(prefilledDate));
    }
  }, [prefilledDate, open]);

  const selectedDate = form.watch("attendance_date");
  const regularizationType = form.watch("regularization_type");

  // Fetch existing attendance when date changes
  useEffect(() => {
    if (selectedDate) {
      setLoadingRecord(true);
      getAttendanceForDate(format(selectedDate, "yyyy-MM-dd"))
        .then(record => {
          setExistingRecord(record);
        })
        .catch(console.error)
        .finally(() => setLoadingRecord(false));
    } else {
      setExistingRecord(null);
    }
  }, [selectedDate]);

  const onSubmit = async (values: FormValues) => {
    const dateStr = format(values.attendance_date, "yyyy-MM-dd");
    
    await createRegularization.mutateAsync({
      attendance_date: dateStr,
      regularization_type: values.regularization_type,
      original_sign_in_time: existingRecord?.sign_in_time || null,
      original_sign_out_time: existingRecord?.sign_out_time || null,
      requested_sign_in_time: values.requested_sign_in_time 
        ? `${dateStr}T${values.requested_sign_in_time}:00+05:30` 
        : null,
      requested_sign_out_time: values.requested_sign_out_time 
        ? `${dateStr}T${values.requested_sign_out_time}:00+05:30` 
        : null,
      reason: values.reason,
    });

    form.reset();
    onOpenChange(false);
  };

  const showSignInField = ['forgot_signin', 'time_correction', 'other'].includes(regularizationType);
  const showSignOutField = ['forgot_signout', 'time_correction', 'other'].includes(regularizationType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Attendance Regularization</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="attendance_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date to Regularize</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(field.value, "PPP") : "Select date"}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date() || date < new Date("2024-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {existingRecord && (
              <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                <div className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Existing Record
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sign In:</span>
                  <span>{existingRecord.sign_in_time ? formatTimeShortIST(existingRecord.sign_in_time) : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sign Out:</span>
                  <span>{existingRecord.sign_out_time ? formatTimeShortIST(existingRecord.sign_out_time) : "N/A"}</span>
                </div>
              </div>
            )}

            {selectedDate && !existingRecord && !loadingRecord && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>No attendance record found for this date</span>
              </div>
            )}

            <FormField
              control={form.control}
              name="regularization_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regularization Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REGULARIZATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {showSignInField && (
                <FormField
                  control={form.control}
                  name="requested_sign_in_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Sign In Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {showSignOutField && (
                <FormField
                  control={form.control}
                  name="requested_sign_out_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Sign Out Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Explain why you need this regularization..." 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRegularization.isPending}>
                {createRegularization.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
