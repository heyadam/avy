# Avy Technical Architecture Guide

A deep-dive into how the codebase works under the hood, covering the execution engine, API layer, streaming implementation, and state management.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Execution Engine](#execution-engine)
3. [API Layer](#api-layer)
4. [Streaming Implementation](#streaming-implementation)
5. [State Management](#state-management)
6. [Autopilot System](#autopilot-system)
7. [Type System](#type-system)
8. [Key Data Flows](#key-data-flows)

---

## System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client (Browser)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │   AgentFlow     │   │  useNodesState  │   │  useAutopilotChat   │   │
│  │   (Orchestrator)│   │  useEdgesState  │   │  (Hook)             │   │
│  └────────┬────────┘   └────────┬────────┘   └──────────┬──────────┘   │
│           │                     │                       │               │
│           ▼                     ▼                       ▼               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Execution Engine                              │   │
│  │                  lib/execution/engine.ts                         │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │ fetch() with streaming
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Server (Next.js API Routes)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────┐       ┌─────────────────────────────────┐ │
│  │  /api/execute           │       │  /api/autopilot                 │ │
│  │  - Prompt execution     │       │  - Flow modification via Claude │ │
│  │  - Image generation     │       │  - Streaming responses          │ │
│  └────────────┬────────────┘       └──────────────┬──────────────────┘ │
│               │                                    │                    │
└───────────────┼────────────────────────────────────┼────────────────────┘
                │                                    │
                ▼                                    ▼
┌───────────────────────────┐        ┌────────────────────────────────────┐
│    Vercel AI SDK          │        │         Anthropic API              │
│  - streamText()           │        │  - Claude Sonnet/Opus 4.5          │
│  - generateText()         │        └────────────────────────────────────┘
└───────────────┬───────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           AI Provider APIs                                 │
├────────────────────┬──────────────────────┬───────────────────────────────┤
│      OpenAI        │       Google         │         Anthropic             │
│  - GPT-5 family    │  - Gemini 2.5/2.0    │  - Claude Sonnet/Haiku        │
│  - Image (gpt-5)   │  - Image (Gemini)    │                               │
└────────────────────┴──────────────────────┴───────────────────────────────┘
```

### File Structure

```
lib/
├── execution/
│   ├── engine.ts       # Core execution logic, graph traversal
│   ├── types.ts        # ExecutionStatus, NodeExecutionState
│   └── graph-utils.ts  # Graph traversal utilities (BFS, path finding)
├── autopilot/
│   ├── types.ts        # FlowAction, FlowChanges, AutopilotMessage
│   ├── parser.ts       # JSON extraction from Claude responses
│   ├── snapshot.ts     # Flow serialization for context
│   └── system-prompt.ts # Claude system prompt builder
├── hooks/
│   └── useAutopilotChat.ts  # Chat state, streaming, apply/undo
├── providers.ts        # AI provider/model configuration
├── api-keys.ts         # API key management
└── example-flow.ts     # Default flow configuration

app/api/
├── execute/route.ts    # Prompt & image execution endpoint
└── autopilot/route.ts  # Claude-powered flow editing endpoint

components/Flow/
├── AgentFlow.tsx       # Main orchestrator component
├── nodes/              # Node components (Input, Prompt, Image, Output)
├── edges/              # Custom edge component with data-type coloring
├── ResponsesSidebar/   # Streaming output display
└── AutopilotSidebar/   # Natural language flow editing UI

types/
└── flow.ts             # Node data interfaces, type definitions
```

---

## Execution Engine

### Location: `lib/execution/engine.ts`

The execution engine implements **recursive graph traversal** with parallel branch execution.

### Core Algorithm

```typescript
executeFlow(nodes, edges, onNodeStateChange, apiKeys)
    │
    ▼
findStartNode(nodes)  // Find the input node
    │
    ▼
executeNodeAndContinue(inputNode, userInput)
    │
    ├──► Set node status to "running"
    │
    ├──► Mark downstream output nodes as "running" (for immediate preview)
    │
    ├──► executeNode(node, input, context, apiKeys, onStreamUpdate)
    │        │
    │        ├── input node:  return { output: input }
    │        ├── output node: return { output: input }
    │        ├── prompt node: fetch /api/execute → stream response
    │        └── image node:  fetch /api/execute → stream partial/final images
    │
    ├──► Store output in context[node.id]
    │
    ├──► Set node status to "success"
    │
    ├──► If output node: capture result, return
    │
    └──► For each outgoing edge:
         └──► Promise.all(executeNodeAndContinue(targetNode, output))
              // Parallel execution of all branches
```

### Key Implementation Details

**Parallel Branch Execution (lines 252-264):**
```typescript
const outgoingEdges = getOutgoingEdges(node.id, edges);
const nextPromises: Promise<void>[] = [];

for (const edge of outgoingEdges) {
  const targetNode = getTargetNode(edge, nodes);
  if (targetNode) {
    // Start executing immediately (don't await individually)
    nextPromises.push(executeNodeAndContinue(targetNode, result.output));
  }
}

// Wait for all downstream branches to complete
await Promise.all(nextPromises);
```

**Streaming Callback Pattern (lines 221-234):**
```typescript
const result = await executeNode(node, input, context, apiKeys, (streamedOutput) => {
  // Update the executing node
  onNodeStateChange(node.id, { status: "running", output: streamedOutput });

  // Also update downstream output nodes with streaming output
  for (const outputNode of downstreamOutputs) {
    onNodeStateChange(outputNode.id, { status: "running", output: streamedOutput });
  }
});
```

### Graph Utilities: `lib/execution/graph-utils.ts`

| Function | Purpose |
|----------|---------|
| `findStartNode(nodes)` | Finds the input node (entry point) |
| `getOutgoingEdges(nodeId, edges)` | Gets all edges leaving a node |
| `getTargetNode(edge, nodes)` | Resolves edge target to node object |
| `findDownstreamOutputNodes(startId, nodes, edges)` | BFS to find reachable output nodes |
| `hasPath(fromId, toId, nodes, edges)` | Checks if path exists between nodes |

**Downstream Output Discovery (BFS):**
```typescript
function findDownstreamOutputNodes(startNodeId, nodes, edges) {
  const outputNodes = [];
  const visited = new Set();

  function traverse(currentId) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    for (const edge of getOutgoingEdges(currentId, edges)) {
      const target = getTargetNode(edge, nodes);
      if (target.type === "output") {
        outputNodes.push(target);
      } else if (target.type === "image") {
        // Stop: image nodes handle their own downstream
      } else {
        traverse(target.id);
      }
    }
  }

  traverse(startNodeId);
  return outputNodes;
}
```

---

## API Layer

### Execute Endpoint: `app/api/execute/route.ts`

Handles two execution types: `prompt` and `image`.

#### Prompt Execution Flow

```
POST /api/execute
Body: { type: "prompt", prompt, provider, model, input, verbosity?, thinking?, apiKeys }
    │
    ▼
Build messages array:
  [{ role: "system", content: prompt }, { role: "user", content: input }]
    │
    ▼
getModel(provider, model, apiKeys)
  ├── openai:    createOpenAI({ apiKey }).model(modelId)
  ├── google:    createGoogleGenerativeAI({ apiKey }).model(modelId)
  └── anthropic: createAnthropic({ apiKey }).model(modelId)
    │
    ▼
streamText({
  model,
  messages,
  maxOutputTokens: 1000,
  providerOptions: { openai: { textVerbosity, reasoningSummary } }
})
    │
    ▼
return result.toTextStreamResponse()
// Returns: ReadableStream of text chunks
```

#### Image Generation Flow

**OpenAI (with streaming partial images):**
```
POST /api/execute
Body: { type: "image", prompt, provider: "openai", model, size, quality, partialImages, ... }
    │
    ▼
openaiClient.responses.create({
  model: "gpt-5",
  input: `Generate an image: ${fullPrompt}`,
  stream: true,
  tools: [{
    type: "image_generation",
    partial_images: 3,
    quality: "low",
    size: "1024x1024",
    output_format: "webp"
  }]
})
    │
    ▼
Stream events:
  ├── "response.image_generation_call.partial_image"
  │     → { type: "partial", index, value: base64, mimeType }
  │
  └── "response.output_item.done"
        → { type: "image", value: base64, mimeType }
    │
    ▼
return new Response(readableStream, {
  headers: { "Content-Type": "application/x-ndjson" }
})
// Returns: Newline-delimited JSON stream
```

**Google (non-streaming):**
```
POST /api/execute
Body: { type: "image", provider: "google", model, aspectRatio, ... }
    │
    ▼
generateText({
  model: google(model),
  prompt: fullPrompt,
  providerOptions: {
    google: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio }
    }
  }
})
    │
    ▼
return NextResponse.json({
  type: "image",
  value: result.files[0].base64,
  mimeType: result.files[0].mediaType
})
```

### Autopilot Endpoint: `app/api/autopilot/route.ts`

```
POST /api/autopilot
Body: { messages, flowSnapshot, model: "claude-sonnet-4-5", apiKeys }
    │
    ▼
buildSystemPrompt(flowSnapshot)
  → Generates ~200 line prompt with:
    - Node type definitions (input, prompt, image, output)
    - Available models per provider
    - Edge connection rules
    - Current flow state as JSON
    - Action definitions (addNode, addEdge, removeEdge)
    - Response format instructions
    │
    ▼
streamText({
  model: anthropic(model),
  system: systemPrompt,
  messages,
  maxOutputTokens: 4000
})
    │
    ▼
return result.toTextStreamResponse()
```

---

## Streaming Implementation

### Client-Side Text Streaming

```typescript
// In executeNode() for prompt nodes
const response = await fetch("/api/execute", { ... });
const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullOutput = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  fullOutput += chunk;
  onStreamUpdate?.(fullOutput);  // Callback updates UI in real-time
}

return { output: fullOutput };
```

### Client-Side Image Streaming (NDJSON)

```typescript
// In executeNode() for image nodes (OpenAI)
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";  // Keep incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;
    const data = JSON.parse(line);

    if (data.type === "partial" || data.type === "image") {
      onStreamUpdate?.(JSON.stringify({
        type: "image",
        value: data.value,
        mimeType: data.mimeType
      }));
    }
  }
}
```

### Server-Side Streaming (Vercel AI SDK)

```typescript
// streamText returns an object with toTextStreamResponse()
const result = streamText({
  model: getModel(provider, model, apiKeys),
  messages,
  maxOutputTokens: 1000
});

// Converts to a streaming Response automatically
return result.toTextStreamResponse();
```

---

## State Management

### React Flow State: `AgentFlow.tsx`

```typescript
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
```

These hooks from `@xyflow/react` provide:
- Immutable state updates
- Automatic change detection (drag, resize, delete)
- Batched updates for performance

### Execution State Updates

```typescript
const updateNodeExecutionState = useCallback((nodeId, state) => {
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

  // Also update preview entries for output nodes
  if (targetNode?.type === "output") {
    if (state.status === "running") {
      addPreviewEntry({ nodeId, status: "running", ... });
    }
    updatePreviewEntry(nodeId, { output: state.output });
  }
}, [setNodes, addPreviewEntry, updatePreviewEntry]);
```

### Preview Entries State

```typescript
const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
const addedPreviewIds = useRef<Set<string>>(new Set());  // Deduplication

interface PreviewEntry {
  id: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  status: ExecutionStatus;
  output?: string;
  error?: string;
  sourceType?: "prompt" | "image";
  timestamp: number;
}
```

---

## Autopilot System

### Architecture

```
User types natural language
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  useAutopilotChat Hook                  │
│  lib/hooks/useAutopilotChat.ts                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. createFlowSnapshot(nodes, edges)                   │
│     → Serialize current graph state                    │
│                                                         │
│  2. POST /api/autopilot                                │
│     → Stream Claude's response                         │
│                                                         │
│  3. parseFlowChanges(response)                         │
│     → Extract JSON actions from response               │
│                                                         │
│  4. onApplyChanges(changes)                            │
│     → Execute addNode/addEdge/removeEdge               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Flow Snapshot: `lib/autopilot/snapshot.ts`

Serializes current flow for Claude context:

```typescript
function createFlowSnapshot(nodes, edges): FlowSnapshot {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: edge.data,
    })),
  };
}
```

### Response Parser: `lib/autopilot/parser.ts`

Extracts JSON from Claude's markdown response:

```typescript
function parseFlowChanges(response: string): FlowChanges | null {
  // Look for ```json ... ``` blocks
  const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
  const matches = [...response.matchAll(jsonBlockRegex)];

  for (const match of matches) {
    const jsonStr = match[1].trim();
    const parsed = JSON.parse(jsonStr);

    if (isValidFlowChanges(parsed)) {
      return parsed;  // { actions: [...], explanation: "..." }
    }
  }
  return null;
}
```

### Action Types: `lib/autopilot/types.ts`

```typescript
type FlowAction = AddNodeAction | AddEdgeAction | RemoveEdgeAction;

interface AddNodeAction {
  type: "addNode";
  node: {
    id: string;
    type: "input" | "output" | "prompt" | "image";
    position: { x: number; y: number };
    data: AgentNodeData;
  };
}

interface AddEdgeAction {
  type: "addEdge";
  edge: {
    id: string;
    source: string;
    target: string;
    data: { dataType: "string" | "image" | "response" };
  };
}

interface RemoveEdgeAction {
  type: "removeEdge";
  edgeId: string;
}

interface FlowChanges {
  actions: FlowAction[];
  explanation: string;
}
```

### Apply Changes: `AgentFlow.tsx`

```typescript
const applyAutopilotChanges = useCallback((changes: FlowChanges) => {
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];

  for (const action of changes.actions) {
    if (action.type === "addNode") {
      nodeIds.push(action.node.id);
      setNodes((nds) => nds.concat({
        ...action.node,
        className: "autopilot-added",  // Purple glow
      }));
    } else if (action.type === "addEdge") {
      edgeIds.push(action.edge.id);
      setEdges((eds) => addEdge({ ...action.edge, type: "colored" }, eds));
    } else if (action.type === "removeEdge") {
      setEdges((eds) => eds.filter((e) => e.id !== action.edgeId));
    }
  }

  setAutopilotHighlightedIds((prev) => new Set([...prev, ...nodeIds]));
  return { nodeIds, edgeIds };  // For undo tracking
}, [setNodes, setEdges]);
```

---

## Type System

### Node Data Types: `types/flow.ts`

```typescript
// Base execution state (added to all nodes during runtime)
interface ExecutionData {
  executionStatus?: "idle" | "running" | "success" | "error";
  executionOutput?: string;
  executionError?: string;
}

// Per-node-type data
interface InputNodeData extends ExecutionData {
  label: string;
  inputValue?: string;
}

interface PromptNodeData extends ExecutionData {
  label: string;
  prompt: string;
  provider?: "openai" | "google" | "anthropic";
  model?: string;
  verbosity?: "low" | "medium" | "high";
  thinking?: boolean;
}

interface ImageNodeData extends ExecutionData {
  label: string;
  prompt?: string;
  provider?: "openai" | "google";
  model?: string;
  outputFormat?: "webp" | "png" | "jpeg";
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "auto" | "low" | "medium" | "high";
  partialImages?: 0 | 1 | 2 | 3;
  aspectRatio?: string;
}

interface OutputNodeData extends ExecutionData {
  label: string;
}

// Union type
type AgentNodeData = InputNodeData | OutputNodeData | PromptNodeData | ImageNodeData;
```

### Execution Types: `lib/execution/types.ts`

```typescript
type ExecutionStatus = "idle" | "running" | "success" | "error";

interface NodeExecutionState {
  status: ExecutionStatus;
  output?: string;
  error?: string;
  sourceType?: string;  // For downstream outputs to know content type
}

type ExecutionState = Record<string, NodeExecutionState>;
```

### Provider Configuration: `lib/providers.ts`

```typescript
const PROVIDERS = {
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-5", label: "GPT-5", supportsVerbosity: true, supportsThinking: true },
      { value: "gpt-5-mini", label: "GPT-5 Mini", supportsVerbosity: true, supportsThinking: true },
      { value: "gpt-5-nano", label: "GPT-5 Nano", supportsVerbosity: true, supportsThinking: false },
    ],
  },
  google: { ... },
  anthropic: { ... },
};

const IMAGE_PROVIDERS = {
  openai: {
    models: [{ value: "gpt-5", label: "GPT-5", supportsPartialImages: true }],
  },
  google: {
    models: [
      { value: "gemini-2.5-flash-image", supportsPartialImages: false },
      { value: "gemini-3-pro-image-preview", supportsPartialImages: false },
    ],
  },
};
```

---

## Key Data Flows

### 1. Workflow Execution

```
User clicks "Run"
    │
    ▼
runFlow() in AgentFlow.tsx
    │
    ├──► Validate API keys for used providers
    │
    ├──► resetExecution() - Clear all node states
    │
    └──► executeFlow(nodes, edges, updateNodeExecutionState, apiKeys)
              │
              ▼
         findStartNode() → InputNode
              │
              ▼
         executeNodeAndContinue(inputNode, userInput)
              │
              ├──► updateNodeExecutionState(nodeId, { status: "running" })
              │
              ├──► executeNode() → fetch("/api/execute") → stream response
              │         │
              │         └──► onStreamUpdate callback updates UI
              │
              ├──► updateNodeExecutionState(nodeId, { status: "success", output })
              │
              └──► Promise.all(downstream nodes)
                        │
                        └──► Recursive parallel execution
```

### 2. Autopilot Flow Modification

```
User types: "Add a translator node"
    │
    ▼
sendMessage() in useAutopilotChat
    │
    ├──► createFlowSnapshot(nodes, edges)
    │
    ├──► POST /api/autopilot { messages, flowSnapshot, model }
    │
    ├──► Stream response, update message content in real-time
    │
    ├──► parseFlowChanges(fullResponse)
    │         │
    │         └──► Extract JSON: { actions: [...], explanation: "..." }
    │
    └──► onApplyChanges(changes)
              │
              ├──► addNode actions → setNodes()
              ├──► addEdge actions → setEdges()
              └──► removeEdge actions → setEdges()
```

### 3. Preview Entry Lifecycle

```
Execution starts
    │
    ▼
Output node marked "running"
    │
    ├──► addPreviewEntry({ nodeId, status: "running", sourceType })
    │    (deduplicated via addedPreviewIds ref)
    │
    ▼
Streaming updates arrive
    │
    ├──► updatePreviewEntry(nodeId, { output: streamedContent })
    │
    ▼
Execution completes
    │
    └──► updatePreviewEntry(nodeId, { status: "success", output: finalOutput })
```

---

## Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| **Execution Engine** | `lib/execution/engine.ts` | Recursive graph traversal, parallel execution |
| **Graph Utils** | `lib/execution/graph-utils.ts` | BFS traversal, path finding, node lookup |
| **Execute API** | `app/api/execute/route.ts` | Prompt/image generation, streaming responses |
| **Autopilot API** | `app/api/autopilot/route.ts` | Claude-powered flow editing |
| **Autopilot Parser** | `lib/autopilot/parser.ts` | JSON extraction from Claude responses |
| **System Prompt** | `lib/autopilot/system-prompt.ts` | Claude context builder |
| **Chat Hook** | `lib/hooks/useAutopilotChat.ts` | Chat state, streaming, apply/undo |
| **AgentFlow** | `components/Flow/AgentFlow.tsx` | Main orchestrator, state management |
| **Providers** | `lib/providers.ts` | AI provider/model configuration |
| **Types** | `types/flow.ts` | Node data interfaces |
