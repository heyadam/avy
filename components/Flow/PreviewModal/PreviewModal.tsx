"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePreviewPosition } from "./usePreviewPosition";
import { PreviewHeader } from "./PreviewHeader";
import { PreviewContent } from "./PreviewContent";
import type { PreviewEntry } from "./types";

interface PreviewModalProps {
  entries: PreviewEntry[];
  onClear: () => void;
}

export function PreviewModal({ entries, onClear }: PreviewModalProps) {
  const { position, handleDragStart, handleResizeStart } = usePreviewPosition();
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden",
        "rounded-xl border bg-background/95 backdrop-blur shadow-lg",
        "transition-shadow hover:shadow-xl"
      )}
      style={{
        left: position.x,
        top: position.y,
        width: position.width,
        maxHeight: isMinimized ? undefined : position.height,
      }}
    >
      <PreviewHeader
        isMinimized={isMinimized}
        onMinimizeToggle={() => setIsMinimized(!isMinimized)}
        onClear={onClear}
        onDragStart={handleDragStart}
        hasEntries={entries.length > 0}
      />

      {!isMinimized && <PreviewContent entries={entries} />}

      {/* Resize handles */}
      {!isMinimized && (
        <>
          {/* Right edge */}
          <div
            className="absolute right-0 top-8 bottom-4 w-1 cursor-e-resize hover:bg-primary/20"
            onMouseDown={(e) => handleResizeStart(e, "right")}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-4 right-4 h-1 cursor-s-resize hover:bg-primary/20"
            onMouseDown={(e) => handleResizeStart(e, "bottom")}
          />
          {/* Bottom-right corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize hover:bg-primary/20 rounded-br-xl"
            onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
          />
          {/* Left edge */}
          <div
            className="absolute left-0 top-8 bottom-4 w-1 cursor-w-resize hover:bg-primary/20"
            onMouseDown={(e) => handleResizeStart(e, "left")}
          />
          {/* Bottom-left corner */}
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize hover:bg-primary/20 rounded-bl-xl"
            onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
          />
        </>
      )}
    </div>
  );
}
