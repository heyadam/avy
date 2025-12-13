"use client";

import { useCallback, useRef, useEffect } from "react";
import type { Node } from "@xyflow/react";
import { DATA_TYPES } from "@/lib/constants";

/**
 * Hook for determining edge data types based on source node type.
 * Used for edge coloring.
 */
export function useFlowEdgeDataType(nodes: Node[]) {
  const nodesRef = useRef(nodes);

  // Keep ref updated with latest nodes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const getEdgeDataType = useCallback((sourceNodeId: string): string => {
    const sourceNode = nodesRef.current.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return DATA_TYPES.DEFAULT;

    switch (sourceNode.type) {
      case "image":
        return DATA_TYPES.IMAGE;
      case "input":
      case "prompt":
        return DATA_TYPES.STRING;
      default:
        return DATA_TYPES.DEFAULT;
    }
  }, []);

  return { getEdgeDataType };
}
