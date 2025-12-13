"use client";

import { ResponsesHeader } from "./ResponsesHeader";
import { ResponsesContent } from "./ResponsesContent";
import { useResizableSidebar } from "@/lib/hooks/useResizableSidebar";
import { RESPONSES_SIDEBAR } from "@/lib/constants";
import type { PreviewEntry } from "./types";

interface ResponsesSidebarProps {
  entries: PreviewEntry[];
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
  keyError?: string | null;
}

export function ResponsesSidebar({
  entries,
  onRun,
  onReset,
  isRunning,
  keyError,
}: ResponsesSidebarProps) {
  const { width, sidebarRef, startResizing } = useResizableSidebar({
    minWidth: RESPONSES_SIDEBAR.MIN_WIDTH,
    maxWidth: RESPONSES_SIDEBAR.MAX_WIDTH,
    defaultWidth: RESPONSES_SIDEBAR.DEFAULT_WIDTH,
    storageKey: RESPONSES_SIDEBAR.STORAGE_KEY,
    handlePosition: "left",
  });

  return (
    <div
      ref={sidebarRef}
      className="flex flex-col h-full border-l bg-background relative"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-yellow-500/50 active:bg-yellow-500/70 transition-colors z-10"
        onMouseDown={startResizing}
      />
      <ResponsesHeader onRun={onRun} onReset={onReset} isRunning={isRunning} keyError={keyError} />
      <ResponsesContent entries={entries} />
    </div>
  );
}
