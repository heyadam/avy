import type { NodeTypes } from "@xyflow/react";
import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { PromptNode } from "./PromptNode";
import { ToolNode } from "./ToolNode";
import { ConditionNode } from "./ConditionNode";

export const nodeTypes: NodeTypes = {
  input: InputNode,
  output: OutputNode,
  prompt: PromptNode,
  tool: ToolNode,
  condition: ConditionNode,
};

export { InputNode, OutputNode, PromptNode, ToolNode, ConditionNode };
