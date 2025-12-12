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

export { InputNode, OutputNode, PromptNode, ImageNode };
