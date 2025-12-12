"use client";

import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import type { InputNodeData } from "@/types/flow";
import { Play } from "lucide-react";
import { NodeFrame } from "./NodeFrame";
import { cn } from "@/lib/utils";

type InputNodeType = Node<InputNodeData, "input">;

export function InputNode({ id, data }: NodeProps<InputNodeType>) {
  const { updateNodeData } = useReactFlow();

  return (
    <NodeFrame
      title={data.label}
      onTitleChange={(label) => updateNodeData(id, { label })}
      icon={<Play className="h-4 w-4" />}
      iconClassName="bg-green-500/10 text-green-600 dark:text-green-300"
      accentBorderClassName="border-l-green-500"
      status={data.executionStatus}
      className="w-[240px]"
    >
      <textarea
        value={data.inputValue || ""}
        onChange={(e) => updateNodeData(id, { inputValue: e.target.value })}
        placeholder="Enter your input..."
        className={cn(
          "nodrag w-full min-h-[84px] resize-y rounded-md border border-input bg-background/60 dark:bg-muted/40 px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        )}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-cyan-500 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm"
      />
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-12">
        <span className="rounded-md bg-cyan-500/50 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300 shadow-sm border border-cyan-500/40">
          string
        </span>
      </div>
    </NodeFrame>
  );
}
