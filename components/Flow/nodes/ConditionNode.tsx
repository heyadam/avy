"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ConditionNodeData } from "@/types/flow";
import { GitBranch } from "lucide-react";
import { NodeFrame } from "./NodeFrame";

type ConditionNodeType = Node<ConditionNodeData, "condition">;

export function ConditionNode({ data }: NodeProps<ConditionNodeType>) {
  return (
    <NodeFrame
      title={data.label}
      icon={<GitBranch className="h-4 w-4" />}
      iconClassName="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
      accentBorderClassName="border-l-yellow-500"
      status={data.executionStatus}
      className="w-[260px]"
      footer={
        data.executionError ? (
          <p className="text-xs text-destructive whitespace-pre-wrap line-clamp-4">
            {data.executionError}
          </p>
        ) : data.executionOutput ? (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
            {data.executionOutput}
          </p>
        ) : null
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

      <div className="space-y-2">
        <p className="text-xs font-mono bg-muted px-2 py-1.5 rounded-md whitespace-pre-wrap line-clamp-4">
          {data.condition}
        </p>

        <div className="flex justify-between px-1 text-[11px] text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">true</span>
          <span className="text-red-600 dark:text-red-400">false</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: "42%" }}
        className="!bg-emerald-500 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: "58%" }}
        className="!bg-red-500 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm"
      />
      <div className="pointer-events-none absolute top-[42%] -translate-y-1/2 -right-12">
        <span className="rounded bg-background/80 px-1 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 shadow-xs border">
          true
        </span>
      </div>
      <div className="pointer-events-none absolute top-[58%] -translate-y-1/2 -right-12">
        <span className="rounded bg-background/80 px-1 py-0.5 text-[10px] text-red-700 dark:text-red-300 shadow-xs border">
          false
        </span>
      </div>
    </NodeFrame>
  );
}
