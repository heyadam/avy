"use client";

import { AutopilotHeader } from "./AutopilotHeader";
import { AutopilotChat } from "./AutopilotChat";
import { useAutopilotChat } from "@/lib/hooks/useAutopilotChat";
import { useResizableSidebar } from "@/lib/hooks/useResizableSidebar";
import { AUTOPILOT_SIDEBAR } from "@/lib/constants";
import type { AutopilotSidebarProps } from "./types";

export function AutopilotSidebar({
  nodes,
  edges,
  onApplyChanges,
  onUndoChanges,
  isOpen,
  onToggle,
}: AutopilotSidebarProps) {
  const { width, sidebarRef, startResizing } = useResizableSidebar({
    minWidth: AUTOPILOT_SIDEBAR.MIN_WIDTH,
    maxWidth: AUTOPILOT_SIDEBAR.MAX_WIDTH,
    defaultWidth: AUTOPILOT_SIDEBAR.DEFAULT_WIDTH,
    storageKey: AUTOPILOT_SIDEBAR.STORAGE_KEY,
    handlePosition: "right",
  });

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    undoChanges,
    clearHistory,
  } = useAutopilotChat({ nodes, edges, onApplyChanges, onUndoChanges });

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={sidebarRef}
      className="flex flex-col h-full border-r bg-background relative overflow-hidden"
      style={{ width }}
    >
      <AutopilotHeader
        onClear={clearHistory}
        onClose={onToggle}
        hasMessages={messages.length > 0}
      />
      <AutopilotChat
        messages={messages}
        isLoading={isLoading}
        error={error}
        onSendMessage={sendMessage}
        onUndoChanges={undoChanges}
      />
      {/* Resize handle - on the right edge for left sidebar */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-500/50 active:bg-purple-500/70 transition-colors z-10"
        onMouseDown={startResizing}
      />
    </div>
  );
}
