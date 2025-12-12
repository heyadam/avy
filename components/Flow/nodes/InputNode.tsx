"use client";

import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import type { InputNodeData } from "@/types/flow";
import { Play } from "lucide-react";
import { NodeFrame } from "./NodeFrame";

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
      className="min-w-[190px]"
      footer={
        data.executionOutput ? (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
            {data.executionOutput}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Entry point for the flow.</p>
        )
      }
    >
      {/* no body content */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm"
      />
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-10">
        <span className="rounded bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground shadow-xs border">
          string
        </span>
      </div>
    </NodeFrame>
  );
}
