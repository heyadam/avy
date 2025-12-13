import type { Node, Edge } from "@xyflow/react";
import type { FlowSnapshot } from "./types";
import type { NodeType, AgentNodeData } from "@/types/flow";

/**
 * Create a minimal snapshot of the flow for Claude context.
 * Excludes execution state and truncates long prompts to save tokens.
 */
function createMinimalNodeData(node: Node): Record<string, unknown> {
  const data = node.data as AgentNodeData;
  const minimal: Record<string, unknown> = {
    label: data.label,
  };

  // Add type-specific fields, truncating long text
  if (node.type === "prompt" || node.type === "image") {
    if (data.prompt) {
      // Truncate prompts to 100 chars
      minimal.prompt = data.prompt.length > 100
        ? data.prompt.slice(0, 100) + "..."
        : data.prompt;
    }
    if (data.provider) minimal.provider = data.provider;
    if (data.model) minimal.model = data.model;
  }

  if (node.type === "image" && data.aspectRatio) {
    minimal.aspectRatio = data.aspectRatio;
  }

  if (node.type === "input" && data.inputValue) {
    // Truncate input values too
    minimal.inputValue = data.inputValue.length > 50
      ? data.inputValue.slice(0, 50) + "..."
      : data.inputValue;
  }

  return minimal;
}

/**
 * Create a serializable snapshot of the current flow state
 * for sending to Claude as context.
 */
export function createFlowSnapshot(
  nodes: Node[],
  edges: Edge[]
): FlowSnapshot {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type as NodeType,
      position: node.position,
      data: createMinimalNodeData(node) as AgentNodeData,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: edge.data as { dataType: string } | undefined,
    })),
  };
}
