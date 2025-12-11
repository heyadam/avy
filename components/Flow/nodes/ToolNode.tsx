"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ToolNodeData } from "@/types/flow";
import { BaseNode, BaseNodeHeader, BaseNodeHeaderTitle, BaseNodeContent } from "@/components/base-node";
import { NodeStatusIndicator, type NodeStatus } from "@/components/node-status-indicator";
import { Wrench } from "lucide-react";

type ToolNodeType = Node<ToolNodeData, "tool">;

function mapStatus(status?: string): NodeStatus {
  if (status === "running") return "loading";
  if (status === "success") return "success";
  if (status === "error") return "error";
  return "initial";
}

export function ToolNode({ data }: NodeProps<ToolNodeType>) {
  const status = mapStatus(data.executionStatus);

  return (
    <NodeStatusIndicator status={status} variant="border">
      <BaseNode className="w-56 border-2 border-purple-500">
        <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />

        <BaseNodeHeader>
          <div className="p-1.5 bg-purple-500 rounded text-white">
            <Wrench className="h-4 w-4" />
          </div>
          <BaseNodeHeaderTitle className="text-sm">{data.label}</BaseNodeHeaderTitle>
        </BaseNodeHeader>

        <BaseNodeContent className="pt-0">
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded w-fit">
            {data.toolName}
          </span>
          {data.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{data.description}</p>
          )}
        </BaseNodeContent>

        {status === "success" && data.executionOutput && (
          <div className="border-t bg-green-50 p-2">
            <p className="text-xs text-green-800 line-clamp-3">{data.executionOutput}</p>
          </div>
        )}

        {status === "error" && data.executionError && (
          <div className="border-t bg-red-50 p-2">
            <p className="text-xs text-red-800 line-clamp-2">{data.executionError}</p>
          </div>
        )}

        <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
      </BaseNode>
    </NodeStatusIndicator>
  );
}
