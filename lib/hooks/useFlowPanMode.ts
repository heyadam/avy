"use client";

import { useEffect } from "react";
import { useKeyPress, type ReactFlowInstance } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { DOM_SELECTORS, CSS_CLASSES } from "@/lib/constants";

export interface UseFlowPanModeProps {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export interface UseFlowPanModeResult {
  /** Whether spacebar is currently pressed (pan mode active) */
  spacePressed: boolean;
}

/**
 * Hook for managing Origami-style pan mode with spacebar.
 * - Normal mouse drag on canvas creates selection box
 * - Hold spacebar + drag to pan the canvas
 */
export function useFlowPanMode({
  reactFlowInstance,
  setNodes,
  setEdges,
}: UseFlowPanModeProps): UseFlowPanModeResult {
  const spacePressed = useKeyPress("Space");

  // Clear any in-progress selection when switching to pan mode
  useEffect(() => {
    if (spacePressed && reactFlowInstance.current) {
      // Deselect all nodes and edges to clear selection rectangle
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    }
  }, [spacePressed, setNodes, setEdges, reactFlowInstance]);

  // Track mouse state to show/hide selection rectangle via CSS class
  useEffect(() => {
    const pane = document.querySelector(DOM_SELECTORS.REACT_FLOW_PANE);
    if (!pane) return;

    const onMouseDown = () => {
      pane.classList.add(CSS_CLASSES.IS_SELECTING);
    };

    const onMouseUp = () => {
      pane.classList.remove(CSS_CLASSES.IS_SELECTING);
    };

    pane.addEventListener("mousedown", onMouseDown);
    pane.addEventListener("pointerdown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerup", onMouseUp);

    return () => {
      pane.removeEventListener("mousedown", onMouseDown);
      pane.removeEventListener("pointerdown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerup", onMouseUp);
    };
  }, []);

  return { spacePressed };
}
