"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { OutputNodeData } from "@/types/flow";
import { Square } from "lucide-react";
import { NodeFrame } from "./NodeFrame";

type OutputNodeType = Node<OutputNodeData, "output">;

export function OutputNode({ data }: NodeProps<OutputNodeType>) {
  return (
    <NodeFrame
      title={data.label}
      icon={<Square className="h-4 w-4" />}
      iconClassName="bg-red-500/10 text-red-600 dark:text-red-300"
      accentBorderClassName="border-l-red-500"
      status={data.executionStatus}
      className="min-w-[190px]"
      footer={
        data.executionError ? (
          <p className="text-xs text-destructive whitespace-pre-wrap line-clamp-4">
            {data.executionError}
          </p>
        ) : data.executionOutput ? (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
            {data.executionOutput}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Final result is shown here.</p>
        )
      }
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm"
      />
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -left-10">
        <span className="rounded bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground shadow-xs border">
          string
        </span>
      </div>
      {/* no body content */}
    </NodeFrame>
  );
}
