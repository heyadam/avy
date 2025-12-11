"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { OutputNodeData } from "@/types/flow";
import { BaseNode, BaseNodeHeader, BaseNodeHeaderTitle } from "@/components/base-node";
import { NodeStatusIndicator, type NodeStatus } from "@/components/node-status-indicator";
import { Square } from "lucide-react";

type OutputNodeType = Node<OutputNodeData, "output">;

function mapStatus(status?: string): NodeStatus {
  if (status === "running") return "loading";
  if (status === "success") return "success";
  if (status === "error") return "error";
  return "initial";
}

export function OutputNode({ data }: NodeProps<OutputNodeType>) {
  const status = mapStatus(data.executionStatus);

  return (
    <NodeStatusIndicator status={status} variant="border">
      <BaseNode className="w-48 border-2 border-red-500">
        <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3" />

        <BaseNodeHeader>
          <div className="p-1.5 bg-red-500 rounded text-white">
            <Square className="h-4 w-4" />
          </div>
          <BaseNodeHeaderTitle className="text-sm">{data.label}</BaseNodeHeaderTitle>
        </BaseNodeHeader>

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
      </BaseNode>
    </NodeStatusIndicator>
  );
}
