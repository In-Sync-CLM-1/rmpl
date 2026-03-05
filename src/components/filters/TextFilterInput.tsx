import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TextFilterInputProps {
  label: string;
  value: string;
  operator: "contains" | "equals" | "starts_with";
  onChange: (value: string, operator: "contains" | "equals" | "starts_with") => void;
  placeholder?: string;
}

export function TextFilterInput({ label, value, operator, onChange, placeholder }: TextFilterInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce the input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue, operator);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, operator]);

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Select value={operator} onValueChange={(val) => onChange(value, val as any)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="starts_with">Starts with</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="text"
          placeholder={placeholder || `Search ${label.toLowerCase()}...`}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="flex-1"
        />
      </div>
    </div>
  );
}
