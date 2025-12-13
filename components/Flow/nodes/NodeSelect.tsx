"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CSS_CLASSES } from "@/lib/constants";

export interface SelectOption {
  value: string;
  label: string;
}

export interface NodeSelectProps {
  /** Label displayed on the left side */
  label: string;
  /** Current selected value */
  value: string;
  /** Callback when value changes */
  onValueChange: (value: string) => void;
  /** Array of options to display */
  options: readonly SelectOption[] | SelectOption[];
  /** Width of the select trigger (default: "100px") */
  width?: string;
}

/**
 * Reusable select component for node configuration.
 * Displays a label on the left and select dropdown on the right.
 */
export function NodeSelect({
  label,
  value,
  onValueChange,
  options,
  width = "100px",
}: NodeSelectProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={`h-7 text-xs ${CSS_CLASSES.NO_DRAG}`}
          style={{ width }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
