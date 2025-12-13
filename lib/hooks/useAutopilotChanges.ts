"use client";

import { useState, useCallback } from "react";
import type { Node, Edge, NodeChange, OnNodesChange } from "@xyflow/react";
import { addEdge } from "@xyflow/react";
import type { FlowChanges, AddNodeAction, AddEdgeAction, RemoveEdgeAction, AppliedChangesInfo } from "@/lib/autopilot/types";
import { CSS_CLASSES, EDGE_TYPE } from "@/lib/constants";

export interface UseAutopilotChangesProps {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: OnNodesChange;
}

export interface UseAutopilotChangesResult {
  autopilotHighlightedIds: Set<string>;
  applyAutopilotChanges: (changes: FlowChanges) => AppliedChangesInfo;
  undoAutopilotChanges: (applied: AppliedChangesInfo) => void;
  handleNodesChangeWithHighlight: OnNodesChange;
}

/**
 * Hook for managing autopilot-related flow changes.
 */
export function useAutopilotChanges({
  setNodes,
  setEdges,
  onNodesChange,
}: UseAutopilotChangesProps): UseAutopilotChangesResult {
  const [autopilotHighlightedIds, setAutopilotHighlightedIds] = useState<Set<string>>(new Set());

  const applyAutopilotChanges = useCallback(
    (changes: FlowChanges): AppliedChangesInfo => {
      const nodeIds: string[] = [];
      const edgeIds: string[] = [];

      for (const action of changes.actions) {
        if (action.type === "addNode") {
          const nodeAction = action as AddNodeAction;
          nodeIds.push(nodeAction.node.id);
          setNodes((nds) =>
            nds.concat({
              id: nodeAction.node.id,
              type: nodeAction.node.type,
              position: nodeAction.node.position,
              data: nodeAction.node.data,
              className: CSS_CLASSES.AUTOPILOT_ADDED,
            })
          );
        } else if (action.type === "addEdge") {
          const edgeAction = action as AddEdgeAction;
          edgeIds.push(edgeAction.edge.id);
          setEdges((eds) =>
            addEdge(
              {
                id: edgeAction.edge.id,
                source: edgeAction.edge.source,
                target: edgeAction.edge.target,
                type: EDGE_TYPE.COLORED,
                data: edgeAction.edge.data,
              },
              eds
            )
          );
        } else if (action.type === "removeEdge") {
          const removeAction = action as RemoveEdgeAction;
          setEdges((eds) => eds.filter((e) => e.id !== removeAction.edgeId));
        }
      }

      // Track highlighted nodes
      setAutopilotHighlightedIds((prev) => new Set([...prev, ...nodeIds]));

      return { nodeIds, edgeIds };
    },
    [setNodes, setEdges]
  );

  const undoAutopilotChanges = useCallback(
    (applied: AppliedChangesInfo) => {
      setNodes((nds) => nds.filter((n) => !applied.nodeIds.includes(n.id)));
      setEdges((eds) => eds.filter((e) => !applied.edgeIds.includes(e.id)));
      // Remove from highlighted set
      setAutopilotHighlightedIds((prev) => {
        const next = new Set(prev);
        applied.nodeIds.forEach((id) => next.delete(id));
        return next;
      });
    },
    [setNodes, setEdges]
  );

  // Wrapper for onNodesChange that clears autopilot highlight when nodes are dragged
  const handleNodesChangeWithHighlight: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Clear highlight for any nodes being dragged
      for (const change of changes) {
        if (
          change.type === "position" &&
          change.dragging &&
          autopilotHighlightedIds.has(change.id)
        ) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === change.id ? { ...n, className: undefined } : n
            )
          );
          setAutopilotHighlightedIds((prev) => {
            const next = new Set(prev);
            next.delete(change.id);
            return next;
          });
        }
      }
      onNodesChange(changes);
    },
    [onNodesChange, autopilotHighlightedIds, setNodes]
  );

  return {
    autopilotHighlightedIds,
    applyAutopilotChanges,
    undoAutopilotChanges,
    handleNodesChangeWithHighlight,
  };
}
