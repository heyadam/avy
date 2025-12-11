"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, GripHorizontal } from "lucide-react";

interface PreviewHeaderProps {
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  onClear: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  hasEntries: boolean;
}

export function PreviewHeader({
  isMinimized,
  onMinimizeToggle,
  onClear,
  onDragStart,
  hasEntries,
}: PreviewHeaderProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 border-b cursor-grab active:cursor-grabbing select-none"
      onMouseDown={onDragStart}
    >
      <div className="flex items-center gap-2">
        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Preview</span>
      </div>
      <div className="flex items-center gap-1">
        {hasEntries && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            title="Clear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onMinimizeToggle();
          }}
          title={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? (
            <Plus className="h-3.5 w-3.5" />
          ) : (
            <Minus className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
