"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ConditionNodeData } from "@/types/flow";
import { BaseNode, BaseNodeHeader, BaseNodeHeaderTitle, BaseNodeContent } from "@/components/base-node";
import { NodeStatusIndicator, type NodeStatus } from "@/components/node-status-indicator";
import { GitBranch } from "lucide-react";

type ConditionNodeType = Node<ConditionNodeData, "condition">;

function mapStatus(status?: string): NodeStatus {
  if (status === "running") return "loading";
  if (status === "success") return "success";
  if (status === "error") return "error";
  return "initial";
}

export function ConditionNode({ data }: NodeProps<ConditionNodeType>) {
  const status = mapStatus(data.executionStatus);

  return (
    <NodeStatusIndicator status={status} variant="border">
      <BaseNode className="w-56 border-2 border-yellow-500">
        <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-3 !h-3" />

        <BaseNodeHeader>
          <div className="p-1.5 bg-yellow-500 rounded text-white">
            <GitBranch className="h-4 w-4" />
          </div>
          <BaseNodeHeaderTitle className="text-sm">{data.label}</BaseNodeHeaderTitle>
        </BaseNodeHeader>

        <BaseNodeContent className="pt-0">
          <p className="text-xs text-muted-foreground font-mono bg-muted p-1.5 rounded">
            {data.condition}
          </p>
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

        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          className="!bg-green-500 !w-3 !h-3 !left-1/3"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          className="!bg-red-500 !w-3 !h-3 !left-2/3"
        />
      </BaseNode>
    </NodeStatusIndicator>
  );
}
