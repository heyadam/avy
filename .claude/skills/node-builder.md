# Node Builder Skill

Build custom node types for the Avy AI workflow builder. This skill guides you through creating properly integrated node types with all required components.

## When to Use

Use this skill when the user wants to:
- Add a new node type to the workflow editor
- Extend the flow system with custom functionality
- Create processing nodes (text transformation, API calls, conditionals, etc.)

## Node Architecture Overview

Every node type requires these components:
1. **Type Definition** (`types/flow.ts`) - TypeScript interface for node data
2. **React Component** (`components/Flow/nodes/`) - Visual node component
3. **Node Definition** (`types/flow.ts`) - Sidebar entry with metadata
4. **Execution Handler** (`lib/execution/engine.ts`) - Runtime behavior
5. **API Route** (`app/api/execute/route.ts`) - Server-side processing (if needed)

## Step-by-Step Implementation

### Step 1: Define the Node Data Type

Add to `types/flow.ts`:

```typescript
// Add interface extending ExecutionData
export interface {NodeName}NodeData extends Record<string, unknown>, ExecutionData {
  label: string;
  // Add node-specific configuration fields
  // Example: threshold?: number;
}

// Add to AgentNodeData union type
export type AgentNodeData =
  | InputNodeData
  | OutputNodeData
  | PromptNodeData
  | ImageNodeData
  | {NodeName}NodeData;  // Add here

// Add to NodeType union
export type NodeType = "input" | "output" | "prompt" | "image" | "{nodetype}";

// Add typed node
export type {NodeName}Node = Node<{NodeName}NodeData, "{nodetype}">;

// Add to AgentNode union
export type AgentNode =
  | InputNode
  | OutputNode
  | PromptNode
  | ImageNode
  | {NodeName}Node;  // Add here
```

### Step 2: Add Node Definition for Sidebar

Add to `nodeDefinitions` array in `types/flow.ts`:

```typescript
{
  type: "{nodetype}",
  label: "{Display Label}",
  description: "{Brief description}",
  color: "bg-{color}-500/10 text-{color}-700 dark:text-{color}-300",
}
```

### Step 3: Create the React Component

Create `components/Flow/nodes/{NodeName}Node.tsx`:

```typescript
"use client";

import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import type { {NodeName}NodeData } from "@/types/flow";
import { {Icon} } from "lucide-react";  // Choose appropriate icon
import { NodeFrame } from "./NodeFrame";
import { cn } from "@/lib/utils";

type {NodeName}NodeType = Node<{NodeName}NodeData, "{nodetype}">;

export function {NodeName}Node({ id, data }: NodeProps<{NodeName}NodeType>) {
  const { updateNodeData } = useReactFlow();

  return (
    <NodeFrame
      title={data.label}
      onTitleChange={(label) => updateNodeData(id, { label })}
      icon={<{Icon} className="h-4 w-4" />}
      iconClassName="bg-{color}-500/10 text-{color}-600 dark:text-{color}-300"
      accentBorderClassName=""
      status={data.executionStatus}
      className="w-[240px]"
      footer={
        data.executionError ? (
          <p className="text-xs text-destructive whitespace-pre-wrap line-clamp-4">
            {data.executionError}
          </p>
        ) : data.executionOutput ? (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
            {data.executionOutput}
          </p>
        ) : null
      }
    >
      {/* Input handle - receives data from previous node */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-{color}-600 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm"
      />
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -left-12">
        <span className="rounded-md bg-{color}-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm">
          string
        </span>
      </div>

      {/* Node configuration UI */}
      <div className="space-y-2">
        {/* Add configuration controls here */}
        {/* Example: */}
        <textarea
          value={typeof data.someField === "string" ? data.someField : ""}
          onChange={(e) => updateNodeData(id, { someField: e.target.value })}
          placeholder="Configuration..."
          className={cn(
            "nodrag w-full min-h-[60px] resize-y rounded-md border border-input bg-background/60 dark:bg-muted/40 px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          )}
        />
      </div>

      {/* Output handle - sends data to next node */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-{color}-600 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm"
      />
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-12">
        <span className="rounded-md bg-{color}-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm">
          string
        </span>
      </div>
    </NodeFrame>
  );
}
```

### Step 4: Register the Node Component

Add to `components/Flow/AgentFlow.tsx`:

```typescript
// Import at top
import { {NodeName}Node } from "./nodes/{NodeName}Node";

// Add to nodeTypes object
const nodeTypes: NodeTypes = {
  input: InputNode,
  output: OutputNode,
  prompt: PromptNode,
  image: ImageNode,
  {nodetype}: {NodeName}Node,  // Add here
};
```

### Step 5: Add Execution Handler

Add case to `executeNode` function in `lib/execution/engine.ts`:

```typescript
case "{nodetype}": {
  // For simple transformations (client-side):
  const config = node.data?.someField || "";
  const result = processInput(input, config);  // Your logic
  return { output: result };

  // For API-dependent operations:
  const response = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "{nodetype}",
      config: node.data.someField,
      input,
      apiKeys,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to execute {nodetype}");
  }

  // Handle streaming or JSON response
  const data = await response.json();
  return { output: data.result };
}
```

### Step 6: Add API Route Handler (if needed)

Add to `app/api/execute/route.ts`:

```typescript
if (type === "{nodetype}") {
  const { config, input } = body;

  // Perform server-side processing
  const result = await processOnServer(config, input);

  return NextResponse.json({ result });
}
```

### Step 7: Update Autopilot System Prompt

Add node description to `lib/autopilot/system-prompt.ts` in the NODE TYPES section:

```typescript
- {nodetype}: {Description of what this node does and its purpose}
```

## Node Patterns

### Input-Only Node (like Output)
- Only has `Handle type="target"` on left
- Receives data, doesn't pass it forward

### Output-Only Node (like Input)
- Only has `Handle type="source"` on right
- Originates data, doesn't receive from others

### Transform Node (like Prompt)
- Has both handles
- Receives input, processes it, outputs result
- Most common pattern for custom nodes

### Branching Node
- Multiple output handles for conditional routing
- Use `id` prop on Handle to distinguish outputs

## Data Type Tags

Use consistent colors for data type labels:
- `string` - gray-600
- `image` - purple-600
- Custom types - choose distinctive colors

## Checklist

Before completing node implementation:
- [ ] Type definition in `types/flow.ts`
- [ ] Node definition in `nodeDefinitions` array
- [ ] React component with NodeFrame wrapper
- [ ] Component registered in `nodeTypes`
- [ ] Execution handler in engine.ts
- [ ] API route handler (if server-side processing needed)
- [ ] Autopilot system prompt updated
- [ ] Test node in flow editor
- [ ] Verify execution works correctly
