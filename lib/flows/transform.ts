import type { Node, Edge } from "@xyflow/react";
import type { FlowNodeRecord, FlowEdgeRecord } from "./types";

/**
 * Fields that contain sensitive content (prompts, model settings)
 * These go into private_data column
 */
const PRIVATE_DATA_FIELDS = [
  "userPrompt",
  "systemPrompt",
  "inputValue",
  "prompt",
  "transformPrompt",
  "generatedCode",
  "codeExplanation",
  "provider",
  "model",
  "verbosity",
  "thinking",
  "googleThinkingConfig",
  "googleSafetySettings",
  "googleSafetyPreset",
  "googleStructuredOutputs",
  "outputFormat",
  "size",
  "quality",
  "partialImages",
  "aspectRatio",
  "stylePreset",
];

/**
 * Fields that are UI state only
 * These go into data column
 */
const UI_DATA_FIELDS = [
  "label",
  "selected",
  "dragging",
  "color",
  "description",
  "isGenerating",
  "userEdited",
  "codeExpanded",
  "evalExpanded",
  "evalResults",
];

/**
 * Split node data into public (UI) and private (content) parts
 */
function splitNodeData(nodeData: Record<string, unknown>): {
  data: Record<string, unknown>;
  privateData: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {};
  const privateData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(nodeData)) {
    // Skip execution state (not persisted)
    if (key.startsWith("execution")) continue;

    if (PRIVATE_DATA_FIELDS.includes(key)) {
      privateData[key] = value;
    } else if (UI_DATA_FIELDS.includes(key)) {
      data[key] = value;
    } else {
      // Unknown fields go to data by default
      data[key] = value;
    }
  }

  return { data, privateData };
}

/**
 * Merge public and private data back together
 */
function mergeNodeData(
  data: Record<string, unknown>,
  privateData: Record<string, unknown>
): Record<string, unknown> {
  return { ...data, ...privateData };
}

/**
 * Transform React Flow Node to DB record
 */
export function nodeToRecord(node: Node, flowId: string): FlowNodeRecord {
  const { data, privateData } = splitNodeData(
    node.data as Record<string, unknown>
  );

  return {
    id: node.id,
    flow_id: flowId,
    type: node.type || "unknown",
    position_x: node.position.x,
    position_y: node.position.y,
    width: node.width ?? node.measured?.width ?? null,
    height: node.height ?? node.measured?.height ?? null,
    data,
    private_data: privateData,
    parent_id: node.parentId ?? null,
  };
}

/**
 * Transform DB record to React Flow Node
 */
export function recordToNode(record: FlowNodeRecord): Node {
  const mergedData = mergeNodeData(record.data, record.private_data);

  return {
    id: record.id,
    type: record.type,
    position: {
      x: record.position_x,
      y: record.position_y,
    },
    data: mergedData,
    ...(record.width && { width: record.width }),
    ...(record.height && { height: record.height }),
    ...(record.parent_id && { parentId: record.parent_id }),
  };
}

/**
 * Transform React Flow Edge to DB record
 */
export function edgeToRecord(edge: Edge, flowId: string): FlowEdgeRecord {
  return {
    id: edge.id,
    flow_id: flowId,
    source_node_id: edge.source,
    source_handle: edge.sourceHandle ?? null,
    target_node_id: edge.target,
    target_handle: edge.targetHandle ?? null,
    edge_type: edge.type || "colored",
    data: (edge.data as Record<string, unknown>) ?? {},
  };
}

/**
 * Transform DB record to React Flow Edge
 */
export function recordToEdge(record: FlowEdgeRecord): Edge {
  return {
    id: record.id,
    source: record.source_node_id,
    sourceHandle: record.source_handle,
    target: record.target_node_id,
    targetHandle: record.target_handle,
    type: record.edge_type || "colored",
    ...(record.data && Object.keys(record.data).length > 0 && { data: record.data }),
  };
}

/**
 * Transform array of React Flow Nodes to DB records
 */
export function nodesToRecords(nodes: Node[], flowId: string): FlowNodeRecord[] {
  return nodes.map((node) => nodeToRecord(node, flowId));
}

/**
 * Transform array of DB records to React Flow Nodes
 */
export function recordsToNodes(records: FlowNodeRecord[]): Node[] {
  return records.map(recordToNode);
}

/**
 * Transform array of React Flow Edges to DB records
 */
export function edgesToRecords(edges: Edge[], flowId: string): FlowEdgeRecord[] {
  return edges.map((edge) => edgeToRecord(edge, flowId));
}

/**
 * Transform array of DB records to React Flow Edges
 */
export function recordsToEdges(records: FlowEdgeRecord[]): Edge[] {
  return records.map(recordToEdge);
}
