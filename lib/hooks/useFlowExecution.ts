"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Node, Edge } from "@xyflow/react";
import { executeFlow } from "@/lib/execution/engine";
import type { NodeExecutionState, ExecutionStatus } from "@/lib/execution/types";
import type { ApiKeys, ProviderId } from "@/lib/api-keys";
import type { NodeType } from "@/types/flow";

export interface PreviewEntry {
  id: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeType;
  status: ExecutionStatus;
  output?: string;
  error?: string;
  timestamp: number;
  sourceType?: NodeType;
}

export interface UseFlowExecutionProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  apiKeys: ApiKeys;
  hasRequiredKey: (providerId: ProviderId) => boolean;
}

export interface UseFlowExecutionResult {
  isRunning: boolean;
  previewEntries: PreviewEntry[];
  keyError: string | null;
  runFlow: () => Promise<void>;
  resetExecution: () => void;
}

/**
 * Hook for managing flow execution state and preview entries.
 */
export function useFlowExecution({
  nodes,
  edges,
  setNodes,
  apiKeys,
  hasRequiredKey,
}: UseFlowExecutionProps): UseFlowExecutionResult {
  const [isRunning, setIsRunning] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
  const [keyError, setKeyError] = useState<string | null>(null);
  const addedPreviewIds = useRef<Set<string>>(new Set());
  const nodesRef = useRef(nodes);

  // Keep ref updated with latest nodes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const addPreviewEntry = useCallback(
    (entry: Omit<PreviewEntry, "id" | "timestamp">) => {
      setPreviewEntries((prev) => [
        ...prev,
        {
          ...entry,
          id: `${entry.nodeId}-${Date.now()}`,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  const updatePreviewEntry = useCallback(
    (nodeId: string, updates: Partial<PreviewEntry>) => {
      setPreviewEntries((prev) =>
        prev.map((entry) =>
          entry.nodeId === nodeId ? { ...entry, ...updates } : entry
        )
      );
    },
    []
  );

  const updateNodeExecutionState = useCallback(
    (nodeId: string, state: NodeExecutionState) => {
      // Update node state
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  executionStatus: state.status,
                  executionOutput: state.output,
                  executionError: state.error,
                },
              }
            : node
        )
      );

      // Handle preview for output/response nodes
      const targetNode = nodesRef.current.find((n) => n.id === nodeId);
      if (targetNode?.type === "output") {
        const nodeLabel = (targetNode.data as { label?: string }).label || "Response";

        if (state.status === "running") {
          // Add to preview immediately when running (dedupe by nodeId)
          if (!addedPreviewIds.current.has(nodeId)) {
            addedPreviewIds.current.add(nodeId);
            addPreviewEntry({
              nodeId,
              nodeLabel,
              nodeType: "output",
              status: "running",
              sourceType: state.sourceType as NodeType | undefined,
            });
          }
          // Update preview with streaming output while running
          if (state.output) {
            updatePreviewEntry(nodeId, {
              status: "running",
              output: state.output,
            });
          } else if (state.sourceType) {
            // Update source type if provided (for loading state)
            updatePreviewEntry(nodeId, {
              status: "running",
              sourceType: state.sourceType as NodeType | undefined,
            });
          }
        } else {
          // Update existing entry when complete
          updatePreviewEntry(nodeId, {
            status: state.status,
            output: state.output,
            error: state.error,
          });
        }
      }
    },
    [setNodes, addPreviewEntry, updatePreviewEntry]
  );

  const resetExecution = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          executionStatus: undefined,
          executionOutput: undefined,
          executionError: undefined,
        },
      }))
    );
    setPreviewEntries([]);
    addedPreviewIds.current.clear();
  }, [setNodes]);

  const runFlow = useCallback(async () => {
    if (isRunning) return;

    // Check which providers are needed based on nodes
    const providersUsed = new Set<ProviderId>();
    nodes.forEach((node) => {
      if (node.type === "prompt" || node.type === "image") {
        const provider = (node.data as { provider?: string }).provider || "openai";
        providersUsed.add(provider as ProviderId);
      }
    });

    // Validate required keys
    const missingProviders: string[] = [];
    for (const provider of providersUsed) {
      if (!hasRequiredKey(provider)) {
        missingProviders.push(provider);
      }
    }

    if (missingProviders.length > 0) {
      setKeyError(`Missing API keys: ${missingProviders.join(", ")}. Open Settings to configure.`);
      return;
    }

    setKeyError(null);
    resetExecution();
    setIsRunning(true);

    try {
      await executeFlow(nodes, edges, updateNodeExecutionState, apiKeys);
    } catch (error) {
      console.error("Flow execution error:", error);
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, isRunning, updateNodeExecutionState, resetExecution, hasRequiredKey, apiKeys]);

  return {
    isRunning,
    previewEntries,
    keyError,
    runFlow,
    resetExecution,
  };
}
