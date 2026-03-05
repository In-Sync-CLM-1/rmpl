import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumericRangeFilterProps {
  label: string;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  placeholder?: string;
}

export function NumericRangeFilter({ label, min, max, onChange, placeholder }: NumericRangeFilterProps) {
  const handleMinChange = (value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    if (numValue !== null && max !== null && numValue > max) {
      return; // Don't allow min to be greater than max
    }
    onChange(numValue, max);
  };

  const handleMaxChange = (value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    if (numValue !== null && min !== null && numValue < min) {
      return; // Don't allow max to be less than min
    }
    onChange(min, numValue);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Min</Label>
          <Input
            type="number"
            placeholder="Min"
            value={min ?? ""}
            onChange={(e) => handleMinChange(e.target.value)}
            step="0.01"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Max</Label>
          <Input
            type="number"
            placeholder="Max"
            value={max ?? ""}
            onChange={(e) => handleMaxChange(e.target.value)}
            step="0.01"
          />
        </div>
      </div>
      {min !== null && max !== null && (
        <p className="text-xs text-muted-foreground">
          Range: {min} - {max}
        </p>
      )}
    </div>
  );
}
