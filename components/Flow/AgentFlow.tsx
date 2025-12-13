"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  SelectionMode,
  type OnConnect,
  type ReactFlowInstance,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges/ColoredEdge";
import { NodeSidebar } from "./NodeSidebar";
import { AutopilotSidebar } from "./AutopilotSidebar";
import { initialNodes, initialEdges } from "@/lib/example-flow";
import type { NodeType } from "@/types/flow";
import { ResponsesSidebar } from "./ResponsesSidebar";
import { useApiKeys } from "@/lib/api-keys";
import { useFlowExecution } from "@/lib/hooks/useFlowExecution";
import { useAutopilotChanges } from "@/lib/hooks/useAutopilotChanges";
import { useFlowPanMode } from "@/lib/hooks/useFlowPanMode";
import { useFlowEdgeDataType } from "@/lib/hooks/useFlowEdgeDataType";
import { EDGE_TYPE, EXECUTION } from "@/lib/constants";

let id = 0;
const getId = () => `node_${id++}`;

const defaultNodeData: Record<NodeType, Record<string, unknown>> = {
  input: { label: "Input", inputValue: "" },
  output: { label: "Response" },
  prompt: { label: "Text", prompt: "", provider: "openai", model: "gpt-5" },
  image: { label: "Image Generator", prompt: "", outputFormat: "webp", size: "1024x1024", quality: "low", partialImages: 3 },
};

export function AgentFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Autopilot sidebar state
  const [autopilotOpen, setAutopilotOpen] = useState(false);

  // API keys context
  const { keys: apiKeys, hasRequiredKey } = useApiKeys();

  // Pan mode (spacebar handling)
  const { spacePressed } = useFlowPanMode({
    reactFlowInstance,
    setNodes,
    setEdges,
  });

  // Autopilot changes management
  const {
    applyAutopilotChanges,
    undoAutopilotChanges,
    handleNodesChangeWithHighlight,
  } = useAutopilotChanges({
    setNodes,
    setEdges,
    onNodesChange,
  });

  // Flow execution
  const {
    isRunning,
    previewEntries,
    keyError,
    runFlow,
    resetExecution,
  } = useFlowExecution({
    nodes,
    edges,
    setNodes,
    apiKeys,
    hasRequiredKey,
  });

  // Edge data type for coloring
  const { getEdgeDataType } = useFlowEdgeDataType(nodes);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const dataType = params.source ? getEdgeDataType(params.source) : "default";
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: EDGE_TYPE.COLORED,
            data: { dataType },
          },
          eds
        )
      );
    },
    [setEdges, getEdgeDataType]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow") as NodeType;

      if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) {
        return;
      }

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { ...defaultNodeData[type] },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  return (
    <div className="flex h-screen w-full">
      {/* Autopilot Sidebar (left) */}
      <AutopilotSidebar
        nodes={nodes}
        edges={edges}
        onApplyChanges={applyAutopilotChanges}
        onUndoChanges={undoAutopilotChanges}
        isOpen={autopilotOpen}
        onToggle={() => setAutopilotOpen(!autopilotOpen)}
      />
      <div ref={reactFlowWrapper} className="flex-1 h-full bg-muted/10">
        <NodeSidebar onOpenAutopilot={() => setAutopilotOpen(true)} autopilotOpen={autopilotOpen} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChangeWithHighlight}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: EDGE_TYPE.COLORED }}
          fitView
          fitViewOptions={{ padding: EXECUTION.FIT_VIEW_PADDING }}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          // Origami-style: normal mouse for select/drag, space+mouse for pan
          // panOnDrag array: 0=left, 1=middle, 2=right mouse buttons
          panOnDrag={spacePressed ? [0, 1, 2] : [1, 2]}
          selectionOnDrag={!spacePressed}
          selectionKeyCode={null}
          selectionMode={SelectionMode.Partial}
          className={spacePressed ? "cursor-grab" : ""}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      <ResponsesSidebar
        entries={previewEntries}
        onRun={runFlow}
        onReset={resetExecution}
        isRunning={isRunning}
        keyError={keyError}
      />
    </div>
  );
}
