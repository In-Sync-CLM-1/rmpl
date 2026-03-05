import { useState } from "react";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfWeek } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface CompactDateRangeFilterProps {
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
}

export function CompactDateRangeFilter({ from, to, onChange }: CompactDateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const presets = [
    {
      label: "Today",
      onClick: () => {
        const today = new Date();
        onChange(today, today);
        setOpen(false);
      },
    },
    {
      label: "Yesterday",
      onClick: () => {
        const yesterday = subDays(new Date(), 1);
        onChange(yesterday, yesterday);
        setOpen(false);
      },
    },
    {
      label: "Last 7 days",
      onClick: () => {
        const today = new Date();
        const lastWeek = subDays(today, 6);
        onChange(lastWeek, today);
        setOpen(false);
      },
    },
    {
      label: "This week",
      onClick: () => {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        onChange(weekStart, today);
        setOpen(false);
      },
    },
    {
      label: "This month",
      onClick: () => {
        const today = new Date();
        const firstDay = startOfMonth(today);
        onChange(firstDay, today);
        setOpen(false);
      },
    },
    {
      label: "Last month",
      onClick: () => {
        const lastMonth = subMonths(new Date(), 1);
        const firstDay = startOfMonth(lastMonth);
        const lastDay = endOfMonth(lastMonth);
        onChange(firstDay, lastDay);
        setOpen(false);
      },
    },
  ];

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date, date);
      setShowCalendar(false);
      setOpen(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setShowCalendar(false);
    }
  };

  // Format display text
  const getDisplayText = () => {
    if (!from || !to) return "Select date";
    
    // Same day
    if (format(from, "yyyy-MM-dd") === format(to, "yyyy-MM-dd")) {
      return format(from, "MMM d, yyyy");
    }
    
    // Different days
    return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`;
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-auto min-w-[140px] justify-start text-left font-normal h-8 text-xs",
            !from && !to && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {showCalendar ? (
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 text-xs -ml-2"
              onClick={() => setShowCalendar(false)}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
            <div className="text-xs font-semibold mb-2 text-muted-foreground">
              Pick a specific date
            </div>
            <Calendar
              mode="single"
              selected={from || undefined}
              onSelect={handleDateSelect}
              initialFocus
              className="pointer-events-auto"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3 min-w-[160px]">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-8"
                onClick={preset.onClick}
              >
                {preset.label}
              </Button>
            ))}
            <Separator className="my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-8"
              onClick={() => setShowCalendar(true)}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-2" />
              Pick a date...
            </Button>
            {(from || to) && (
              <>
                <Separator className="my-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs h-8 text-muted-foreground"
                  onClick={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                >
                  Clear
                </Button>
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
