"use client";

import { PanelLeft, Folder, FilePlus, FolderOpen, Download, Cloud, Globe, Save } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnimatedLabel } from "./AnimatedLabel";
import type { LeftControlsProps } from "./types";

export function LeftControls({
  autopilotOpen,
  onAutopilotToggle,
  showLabels,
  isAuthenticated,
  onSaveFlow,
  onNewFlow,
  onOpenTemplates,
  onOpenMyFlows,
  onOpenFlow,
  onDownload,
  liveSession,
  onShareDialogChange,
}: LeftControlsProps) {
  const handleNewFlow = () => {
    onNewFlow();
    onOpenTemplates();
  };

  const shareTooltip = liveSession ? "Share settings" : "Publish this flow";

  return (
    <div className="flex items-center gap-2">
      {/* Autopilot */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onAutopilotToggle}
            className={`flex items-center gap-1.5 px-2.5 py-2 transition-colors rounded-full border bg-background/50 backdrop-blur-sm text-sm cursor-pointer ${
              autopilotOpen
                ? "text-foreground border-muted-foreground/40"
                : "text-muted-foreground/60 hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40"
            }`}
          >
            <PanelLeft className="w-4 h-4 shrink-0" />
            <AnimatedLabel show={showLabels}>AI</AnimatedLabel>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-neutral-800 text-white border-neutral-700">
          Composer AI
        </TooltipContent>
      </Tooltip>

      {/* Flow dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1.5 px-2.5 py-2 text-muted-foreground/60 hover:text-foreground transition-colors rounded-full border border-muted-foreground/20 hover:border-muted-foreground/40 bg-background/50 backdrop-blur-sm text-sm cursor-pointer"
            title="Files"
          >
            <Folder className="w-4 h-4 shrink-0" />
            <AnimatedLabel show={showLabels}>Flow</AnimatedLabel>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="bg-neutral-900 border-neutral-700 text-white min-w-[160px]"
        >
          <DropdownMenuItem
            onClick={handleNewFlow}
            className="cursor-pointer hover:bg-neutral-800 focus:bg-neutral-800"
          >
            <FilePlus className="h-4 w-4 mr-2" />
            New Flow
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onSaveFlow}
            className="cursor-pointer hover:bg-neutral-800 focus:bg-neutral-800"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Flow
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-neutral-700" />
          {isAuthenticated && (
            <DropdownMenuItem
              onClick={onOpenMyFlows}
              className="cursor-pointer hover:bg-neutral-800 focus:bg-neutral-800"
            >
              <Cloud className="h-4 w-4 mr-2" />
              My Flows
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={onOpenFlow}
            className="cursor-pointer hover:bg-neutral-800 focus:bg-neutral-800"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Open from file...
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDownload}
            className="cursor-pointer hover:bg-neutral-800 focus:bg-neutral-800"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onShareDialogChange(true)}
            className={`flex items-center gap-1.5 px-2.5 py-2 transition-colors rounded-full border bg-background/50 backdrop-blur-sm text-sm cursor-pointer ${
              liveSession
                ? "text-cyan-400 hover:text-cyan-300 border-cyan-500/30 hover:border-cyan-400/50"
                : "text-muted-foreground/60 hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40"
            }`}
            title={shareTooltip}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <AnimatedLabel show={showLabels}>Share</AnimatedLabel>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-neutral-800 text-white border-neutral-700">
          {shareTooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
