"use client";

import type { PreviewEntry as PreviewEntryType } from "./types";
import {
  MessageSquare,
  Square,
  Wrench,
  GitBranch,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nodeIcons = {
  input: ArrowRight,
  output: Square,
  prompt: MessageSquare,
  tool: Wrench,
  condition: GitBranch,
};

const nodeColors = {
  input: "text-green-500",
  output: "text-red-500",
  prompt: "text-blue-500",
  tool: "text-purple-500",
  condition: "text-yellow-500",
};

interface PreviewEntryProps {
  entry: PreviewEntryType;
}

export function PreviewEntry({ entry }: PreviewEntryProps) {
  const Icon = nodeIcons[entry.nodeType] || MessageSquare;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        entry.status === "running" && "bg-primary/5 border-primary/20",
        entry.status === "success" && "bg-emerald-500/5 border-emerald-500/20",
        entry.status === "error" && "bg-destructive/5 border-destructive/20"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", nodeColors[entry.nodeType])} />
          <span className="text-sm font-medium">{entry.nodeLabel}</span>
        </div>
        <StatusIndicator status={entry.status} />
      </div>

      {entry.error && (
        <p className="text-xs text-destructive whitespace-pre-wrap break-words">
          {entry.error}
        </p>
      )}

      {entry.output && !entry.error && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
          {entry.output}
        </p>
      )}

      {entry.status === "running" && !entry.output && !entry.error && (
        <p className="text-xs text-muted-foreground italic">Processing...</p>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: PreviewEntryType["status"] }) {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  if (status === "success") {
    return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  }
  if (status === "error") {
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  }
  return null;
}
