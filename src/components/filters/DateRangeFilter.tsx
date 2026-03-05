import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  label: string;
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
}

export function DateRangeFilter({ label, from, to, onChange }: DateRangeFilterProps) {
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  const presetRanges = [
    {
      label: "Today",
      onClick: () => {
        const today = new Date();
        onChange(today, today);
      },
    },
    {
      label: "Last 7 days",
      onClick: () => {
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        onChange(lastWeek, today);
      },
    },
    {
      label: "Last 30 days",
      onClick: () => {
        const today = new Date();
        const lastMonth = new Date(today);
        lastMonth.setDate(lastMonth.getDate() - 30);
        onChange(lastMonth, today);
      },
    },
    {
      label: "This month",
      onClick: () => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        onChange(firstDay, today);
      },
    },
  ];

  return (
    <div className="space-y-3">
      <Label className="text-sm">{label}</Label>
      
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {presetRanges.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={preset.onClick}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
        {(from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null, null)}
            className="text-xs text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Date Pickers */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Popover open={openFrom} onOpenChange={setOpenFrom}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {from ? format(from, "PP") : <span>Pick date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={from || undefined}
                onSelect={(date) => {
                  onChange(date || null, to);
                  setOpenFrom(false);
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Popover open={openTo} onOpenChange={setOpenTo}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !to && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {to ? format(to, "PP") : <span>Pick date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={to || undefined}
                onSelect={(date) => {
                  onChange(from, date || null);
                  setOpenTo(false);
                }}
                disabled={(date) => from ? date < from : false}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
