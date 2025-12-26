"use client";

import {
  Plus,
  RotateCcw,
  Play,
  Square,
  MessageSquarePlus,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getTransition } from "@/lib/motion/presets";

interface ActionBarProps {
  onToggleNodes: () => void;
  onCommentAround: () => void;
  onRun: () => void;
  onCancel: () => void;
  onReset: () => void;
  nodesPaletteOpen: boolean;
  isRunning: boolean;
  hasSelection: boolean;
  /** Width of left sidebar when open */
  autopilotWidth?: number;
  /** Whether left sidebar is open */
  autopilotOpen?: boolean;
  /** Whether a sidebar is being resized */
  isResizing?: boolean;
  /** Reason why run is disabled (if any) - shown in tooltip */
  runDisabledReason?: string;
}

export function ActionBar({
  onToggleNodes,
  onCommentAround,
  onRun,
  onCancel,
  onReset,
  nodesPaletteOpen,
  isRunning,
  hasSelection,
  autopilotWidth = 0,
  autopilotOpen = false,
  isResizing = false,
  runDisabledReason,
}: ActionBarProps) {
  // Calculate offset to keep centered in visible area when sidebars open
  // Left sidebar overlays canvas, so we need to offset by half its width
  // Right sidebar shrinks the canvas (flex sibling), so ActionBar naturally centers - no offset needed
  const centerOffset = autopilotOpen ? autopilotWidth / 2 : 0;

  return (
    <TooltipProvider delayDuration={200}>
        <motion.div
          className="absolute bottom-6 left-1/2 z-20"
          initial={false}
          animate={{ x: `calc(-50% + ${centerOffset}px)` }}
          transition={getTransition(isResizing)}
        >
          <div className="flex items-center gap-1 p-1.5 rounded-xl bg-neutral-900/95 backdrop-blur border border-neutral-700 shadow-lg">
            {/* Section 1: Add Node & Comment */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleNodes}
                  data-node-toolbar-toggle
                  className={`h-10 w-10 rounded-lg transition-colors ${
                    nodesPaletteOpen
                      ? "bg-neutral-700 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-neutral-800 text-white border-neutral-700">
                Add Node
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCommentAround}
                  disabled={!hasSelection}
                  className="h-10 w-10 rounded-lg transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <MessageSquarePlus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-neutral-800 text-white border-neutral-700">
                {hasSelection ? "Comment Around" : "Select nodes first"}
              </TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px h-6 bg-neutral-700 mx-1" />

            {/* Section 3: Reset & Run */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isRunning}
                  className="h-10 w-10 rounded-lg transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-neutral-800 text-white border-neutral-700">
                Reset
              </TooltipContent>
            </Tooltip>

            {isRunning ? (
              <Button
                onClick={onCancel}
                className="h-10 px-4 rounded-lg gap-2 bg-red-600 text-white hover:bg-red-500"
              >
                <Square className="h-4 w-4" />
                Cancel
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      onClick={onRun}
                      disabled={!!runDisabledReason}
                      className="h-10 px-4 rounded-lg gap-2 bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                    >
                      <Play className="h-4 w-4" />
                      Run
                    </Button>
                  </span>
                </TooltipTrigger>
                {runDisabledReason && (
                  <TooltipContent side="top" className="bg-neutral-800 text-white border-neutral-700">
                    {runDisabledReason}
                  </TooltipContent>
                )}
              </Tooltip>
            )}
          </div>
        </motion.div>
    </TooltipProvider>
  );
}
