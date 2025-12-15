import type { NodeTypes } from "@xyflow/react";
import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { PromptNode } from "./PromptNode";
import { ImageNode } from "./ImageNode";
import { ImageInputNode } from "./ImageInputNode";
import { MagicNode } from "./MagicNode";

export const nodeTypes: NodeTypes = {
  "text-input": InputNode,
  "preview-output": OutputNode,
  "text-generation": PromptNode,
  "image-generation": ImageNode,
  "image-input": ImageInputNode,
  "ai-logic": MagicNode,
};

export { InputNode, OutputNode, PromptNode, ImageNode, ImageInputNode, MagicNode };
