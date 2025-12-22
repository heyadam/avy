import { useCallback, useState, type MutableRefObject } from "react";
import type { Node, Edge, ReactFlowInstance } from "@xyflow/react";
import { createFlow, updateFlow, loadFlow } from "@/lib/flows/api";
import {
  createSavedFlow,
  downloadFlow,
  openFlowFilePicker,
  type FlowMetadata,
} from "@/lib/flow-storage";
import type { SavedFlow } from "@/lib/flow-storage/types";

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;
type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;

export type SaveMode = "download" | "cloud";

// Update ID counter based on existing nodes to avoid collisions
const updateIdCounter = (nodes: Node[], setIdCounter: (id: number) => void) => {
  const maxId = nodes.reduce((max, node) => {
    const match = node.id.match(/node_(\d+)/);
    if (match) {
      return Math.max(max, parseInt(match[1], 10));
    }
    return max;
  }, -1);
  setIdCounter(maxId + 1);
};

export interface UseFlowOperationsOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: SetNodes;
  setEdges: SetEdges;
  resetExecution: () => void;
  clearHighlights: () => void;
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  onFlowChange?: () => void; // Callback when flow is loaded/changed
  setIdCounter: (id: number) => void;
  shouldShowTemplatesModal: () => boolean;
  setTemplatesModalOpen: (open: boolean) => void;
}

export interface UseFlowOperationsReturn {
  // State
  flowMetadata: FlowMetadata | undefined;
  currentFlowId: string | null;
  isSaving: boolean;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (open: boolean) => void;
  myFlowsDialogOpen: boolean;
  setMyFlowsDialogOpen: (open: boolean) => void;

  // Handlers
  loadBlankCanvas: () => void;
  handleNewFlow: () => void;
  handleSelectTemplate: (flow: SavedFlow) => void;
  handleSaveFlow: (name: string, mode: SaveMode) => Promise<void>;
  handleLoadCloudFlow: (flowId: string) => Promise<void>;
  handleOpenFlow: () => Promise<void>;
}

/**
 * Hook to manage flow file operations (new, save, load, templates)
 *
 * Handles:
 * - Creating new blank flows
 * - Loading templates
 * - Saving to cloud or downloading
 * - Loading from cloud or file picker
 * - Flow metadata management
 */
export function useFlowOperations({
  nodes,
  edges,
  setNodes,
  setEdges,
  resetExecution,
  clearHighlights,
  reactFlowInstance,
  onFlowChange,
  setIdCounter,
  shouldShowTemplatesModal,
  setTemplatesModalOpen,
}: UseFlowOperationsOptions): UseFlowOperationsReturn {
  // Flow metadata state
  const [flowMetadata, setFlowMetadata] = useState<FlowMetadata | undefined>(undefined);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [myFlowsDialogOpen, setMyFlowsDialogOpen] = useState(false);

  // Load a blank canvas with default metadata
  const loadBlankCanvas = useCallback(() => {
    const now = new Date().toISOString();
    setNodes([]);
    setEdges([]);
    setFlowMetadata({
      name: "Untitled Flow",
      description: "",
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    setCurrentFlowId(null);
    resetExecution();
    clearHighlights();
    onFlowChange?.();
    updateIdCounter([], setIdCounter);
  }, [setNodes, setEdges, resetExecution, clearHighlights, onFlowChange, setIdCounter]);

  // Create a new flow (clears canvas, optionally shows templates)
  const handleNewFlow = useCallback(() => {
    loadBlankCanvas();
    if (shouldShowTemplatesModal()) {
      setTemplatesModalOpen(true);
    }
  }, [loadBlankCanvas, shouldShowTemplatesModal, setTemplatesModalOpen]);

  // Load a template flow
  const handleSelectTemplate = useCallback(
    (flow: SavedFlow) => {
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setFlowMetadata(flow.metadata);
      setCurrentFlowId(null);
      resetExecution();
      clearHighlights();
      onFlowChange?.();
      updateIdCounter(flow.nodes, setIdCounter);

      // Fit view to show loaded template
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2 });
      }, 50);
    },
    [setNodes, setEdges, resetExecution, clearHighlights, onFlowChange, setIdCounter, reactFlowInstance]
  );

  // Save flow to cloud or download
  const handleSaveFlow = useCallback(
    async (name: string, mode: SaveMode) => {
      const flow = createSavedFlow(nodes, edges, name, flowMetadata);
      setFlowMetadata(flow.metadata);

      if (mode === "download") {
        downloadFlow(flow);
        setSaveDialogOpen(false);
      } else {
        // Cloud save
        setIsSaving(true);
        try {
          let result;
          if (currentFlowId) {
            // Update existing flow
            result = await updateFlow(currentFlowId, flow);
          } else {
            // Create new flow
            result = await createFlow(flow);
          }

          if (result.success && result.flow) {
            setCurrentFlowId(result.flow.id);
            setSaveDialogOpen(false);
          } else {
            alert(result.error || "Failed to save flow");
          }
        } catch (error) {
          console.error("Error saving flow:", error);
          alert("Failed to save flow");
        } finally {
          setIsSaving(false);
        }
      }
    },
    [nodes, edges, flowMetadata, currentFlowId]
  );

  // Load flow from cloud
  const handleLoadCloudFlow = useCallback(
    async (flowId: string) => {
      const result = await loadFlow(flowId);
      if (result.success && result.flow) {
        setNodes(result.flow.nodes);
        setEdges(result.flow.edges);
        setFlowMetadata(result.flow.metadata);
        setCurrentFlowId(flowId);
        resetExecution();
        clearHighlights();
        onFlowChange?.();
        updateIdCounter(result.flow.nodes, setIdCounter);

        // Fit view to show loaded flow
        setTimeout(() => {
          reactFlowInstance.current?.fitView({ padding: 0.2 });
        }, 50);
      } else {
        console.error("Failed to load cloud flow:", result.error);
        alert(`Failed to load flow: ${result.error}`);
      }
    },
    [setNodes, setEdges, resetExecution, clearHighlights, onFlowChange, setIdCounter, reactFlowInstance]
  );

  // Open flow from file picker
  const handleOpenFlow = useCallback(async () => {
    const result = await openFlowFilePicker();
    if (result.success && result.flow) {
      setNodes(result.flow.nodes);
      setEdges(result.flow.edges);
      setFlowMetadata(result.flow.metadata);
      setCurrentFlowId(null); // Clear cloud flow ID when loading from file
      resetExecution();
      clearHighlights();
      onFlowChange?.();
      updateIdCounter(result.flow.nodes, setIdCounter);

      // Fit view to show loaded flow
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2 });
      }, 50);

      // Show warnings if any
      if (result.validation?.warnings.length) {
        console.warn("Flow loaded with warnings:", result.validation.warnings);
      }
    } else if (result.error && result.error !== "File selection cancelled") {
      console.error("Failed to open flow:", result.error);
      alert(`Failed to open flow: ${result.error}`);
    }
  }, [setNodes, setEdges, resetExecution, clearHighlights, onFlowChange, setIdCounter, reactFlowInstance]);

  return {
    // State
    flowMetadata,
    currentFlowId,
    isSaving,
    saveDialogOpen,
    setSaveDialogOpen,
    myFlowsDialogOpen,
    setMyFlowsDialogOpen,

    // Handlers
    loadBlankCanvas,
    handleNewFlow,
    handleSelectTemplate,
    handleSaveFlow,
    handleLoadCloudFlow,
    handleOpenFlow,
  };
}
