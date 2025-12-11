"use client";

import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import type { PromptNodeData } from "@/types/flow";
import { BaseNode, BaseNodeHeader, BaseNodeHeaderTitle, BaseNodeContent } from "@/components/base-node";
import { NodeStatusIndicator, type NodeStatus } from "@/components/node-status-indicator";
import { MessageSquare } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PromptNodeType = Node<PromptNodeData, "prompt">;

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "o1", label: "o1" },
  { value: "o1-mini", label: "o1 Mini" },
  { value: "o3-mini", label: "o3 Mini" },
];

function mapStatus(status?: string): NodeStatus {
  if (status === "running") return "loading";
  if (status === "success") return "success";
  if (status === "error") return "error";
  return "initial";
}

export function PromptNode({ id, data }: NodeProps<PromptNodeType>) {
  const { updateNodeData } = useReactFlow();
  const status = mapStatus(data.executionStatus);

  const handleModelChange = (model: string) => {
    updateNodeData(id, { model });
  };

  return (
    <NodeStatusIndicator status={status} variant="border">
      <BaseNode className="w-56 border-2 border-blue-500">
        <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />

        <BaseNodeHeader>
          <div className="p-1.5 bg-blue-500 rounded text-white">
            <MessageSquare className="h-4 w-4" />
          </div>
          <BaseNodeHeaderTitle className="text-sm">{data.label}</BaseNodeHeaderTitle>
        </BaseNodeHeader>

        <BaseNodeContent className="pt-0">
          <p className="text-xs text-muted-foreground line-clamp-2">{data.prompt}</p>
          <Select value={data.model || "gpt-4o"} onValueChange={handleModelChange}>
            <SelectTrigger className="h-7 text-xs nodrag">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {OPENAI_MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value} className="text-xs">
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
      </BaseNode>
    </NodeStatusIndicator>
  );
}
