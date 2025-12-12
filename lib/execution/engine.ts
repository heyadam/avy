import type { Node, Edge } from "@xyflow/react";
import type { NodeExecutionState } from "./types";

// Find the starting node (input node)
function findStartNode(nodes: Node[]): Node | undefined {
  return nodes.find((n) => n.type === "input");
}

// Get outgoing edges from a node
function getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.source === nodeId);
}

// Get the target node from an edge
function getTargetNode(edge: Edge, nodes: Node[]): Node | undefined {
  return nodes.find((n) => n.id === edge.target);
}

// Execute a single node
async function executeNode(
  node: Node,
  input: string,
  context: Record<string, unknown>
): Promise<{ output: string }> {
  switch (node.type) {
    case "input":
      return { output: input };

    case "output":
      return { output: input };

    case "prompt": {
      const prompt = typeof node.data?.prompt === "string" ? node.data.prompt : "";
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "prompt",
          prompt: prompt,
          model: node.data.model || "gpt-5.2-2025-12-11",
          input,
          context,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to execute prompt");
      return { output: data.output };
    }

    default:
      return { output: input };
  }
}

export async function executeFlow(
  nodes: Node[],
  edges: Edge[],
  userInput: string,
  onNodeStateChange: (nodeId: string, state: NodeExecutionState) => void
): Promise<string> {
  const startNode = findStartNode(nodes);
  if (!startNode) {
    throw new Error("No input node found");
  }

  const context: Record<string, unknown> = { userInput };
  const outputs: string[] = [];

  // Recursive function to execute a node and its downstream nodes
  async function executeNodeAndContinue(node: Node, input: string): Promise<void> {
    onNodeStateChange(node.id, { status: "running" });

    try {
      // Small delay for visual feedback
      await new Promise((r) => setTimeout(r, 300));

      // Execute the node
      const result = await executeNode(node, input, context);

      // Store output in context
      context[node.id] = result.output;

      // Set node to success
      onNodeStateChange(node.id, {
        status: "success",
        output: result.output,
      });

      // If this is an output node, capture the output
      if (node.type === "output") {
        outputs.push(result.output);
        return;
      }

      // Find and execute next nodes in parallel
      const outgoingEdges = getOutgoingEdges(node.id, edges);
      const nextPromises: Promise<void>[] = [];

      for (const edge of outgoingEdges) {
        const targetNode = getTargetNode(edge, nodes);
        if (targetNode) {
          // Start executing the next node immediately (don't await)
          nextPromises.push(executeNodeAndContinue(targetNode, result.output));
        }
      }

      // Wait for all downstream branches to complete
      await Promise.all(nextPromises);
    } catch (error) {
      onNodeStateChange(node.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Start execution from the start node
  await executeNodeAndContinue(startNode, userInput);

  return outputs[outputs.length - 1] || "";
}
