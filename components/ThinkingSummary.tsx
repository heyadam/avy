"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";

interface ThinkingSummaryProps {
  reasoning: string;
  defaultExpanded?: boolean;
  maxHeight?: string;
  className?: string;
  isStreaming?: boolean;
}

export function ThinkingSummary({
  reasoning,
  defaultExpanded = false,
  maxHeight = "120px",
  className,
  isStreaming = false,
}: ThinkingSummaryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!reasoning) return null;

  return (
    <div className={cn("border border-border/50 rounded-md overflow-hidden", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="nodrag w-full flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/50 hover:bg-muted transition-colors"
      >
        <Brain className="h-3 w-3" />
        {isStreaming ? (
          <Shimmer as="span" duration={1.5}>
            Thinking
          </Shimmer>
        ) : (
          <span>Thinking</span>
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3 ml-auto" />
        ) : (
          <ChevronRight className="h-3 w-3 ml-auto" />
        )}
      </button>
      {expanded && (
        <p
          className="px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap overflow-y-auto"
          style={{ maxHeight }}
        >
          {reasoning}
        </p>
      )}
    </div>
  );
}
