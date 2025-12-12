import type { Node, Edge } from "@xyflow/react";

export const initialNodes: Node[] = [
  {
    id: "input-1",
    type: "input",
    position: { x: 0, y: 150 },
    data: { label: "User Input", inputValue: "A cute robot surfing" },
  },
  {
    id: "prompt-1",
    type: "prompt",
    position: { x: 350, y: 100 },
    data: {
      label: "GPT-5 Nano",
      prompt: "Write a simple prompt for image generation",
      provider: "openai",
      model: "gpt-5-nano",
    },
  },
  {
    id: "image-1",
    type: "image",
    position: { x: 750, y: 200 },
    data: {
      label: "Gemini 2.5 Flash",
      prompt: "",
      provider: "google",
      model: "gemini-2.5-flash-image",
      aspectRatio: "1:1",
    },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 900, y: 0 },
    data: { label: "Text Response" },
  },
  {
    id: "output-2",
    type: "output",
    position: { x: 1100, y: 250 },
    data: { label: "Image Response" },
  },
];

export const initialEdges: Edge[] = [
  {
    id: "e-input-prompt1",
    source: "input-1",
    target: "prompt-1",
    type: "colored",
    data: { dataType: "string" },
  },
  {
    id: "e-prompt1-output1",
    source: "prompt-1",
    target: "output-1",
    type: "colored",
    data: { dataType: "string" },
  },
  {
    id: "e-prompt1-image1",
    source: "prompt-1",
    target: "image-1",
    type: "colored",
    data: { dataType: "string" },
  },
  {
    id: "e-image1-output2",
    source: "image-1",
    target: "output-2",
    type: "colored",
    data: { dataType: "image" },
  },
];
