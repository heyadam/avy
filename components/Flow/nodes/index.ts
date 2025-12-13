import type { NodeTypes } from "@xyflow/react";
import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { PromptNode } from "./PromptNode";
import { ImageNode } from "./ImageNode";

export const nodeTypes: NodeTypes = {
  input: InputNode,
  output: OutputNode,
  prompt: PromptNode,
  image: ImageNode,
};

// Node components
export { InputNode, OutputNode, PromptNode, ImageNode };

// Shared node UI components
export { NodeFrame } from "./NodeFrame";
export { NodeSelect, type NodeSelectProps, type SelectOption } from "./NodeSelect";
export { NodeHandle, type NodeHandleProps } from "./NodeHandle";
export { NodeStatusBadge } from "./NodeStatusBadge";
