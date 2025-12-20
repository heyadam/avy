import type { FlowSnapshot, FlowChanges, EvaluationResult } from "./types";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface EvaluatorOptions {
  userRequest: string;
  flowSnapshot: FlowSnapshot;
  changes: FlowChanges;
  apiKey?: string;
}

/**
 * Evaluate flow changes using Claude Haiku for fast validation.
 * Checks semantic correctness, structural validity, and completeness.
 */
export async function evaluateFlowChanges(
  options: EvaluatorOptions
): Promise<EvaluationResult> {
  const { userRequest, flowSnapshot, changes, apiKey } = options;

  const anthropic = createAnthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  });

  const prompt = buildEvaluatorPrompt(userRequest, flowSnapshot, changes);

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      prompt,
      maxOutputTokens: 500,
    });

    return parseEvaluationResponse(result.text);
  } catch (error) {
    console.error("Evaluation error:", error);
    // On error, assume valid to avoid blocking
    return {
      valid: true,
      issues: [],
      suggestions: [],
    };
  }
}

/**
 * Parse the evaluator's JSON response.
 */
function parseEvaluationResponse(response: string): EvaluationResult {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      valid: Boolean(parsed.valid),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    // If parsing fails, try to detect obvious errors in the text
    const lowerResponse = response.toLowerCase();
    if (
      lowerResponse.includes("invalid") ||
      lowerResponse.includes("error") ||
      lowerResponse.includes("issue")
    ) {
      return {
        valid: false,
        issues: ["Validation detected issues but could not parse details"],
        suggestions: [],
      };
    }
    // Default to valid if we can't parse
    return {
      valid: true,
      issues: [],
      suggestions: [],
    };
  }
}

/**
 * Build the prompt for the evaluator model.
 */
// Valid model IDs by provider and node type
const VALID_TEXT_MODELS = {
  openai: ["gpt-5.2", "gpt-5-mini", "gpt-5-nano"],
  google: ["gemini-3-pro-preview", "gemini-3-flash-preview"],
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
};

const VALID_IMAGE_MODELS = {
  openai: ["gpt-image-1", "dall-e-3", "dall-e-2"],
  google: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "imagen-4.0-generate-001", "imagen-4.0-ultra-generate-001", "imagen-4.0-fast-generate-001"],
};

function buildEvaluatorPrompt(
  userRequest: string,
  flowSnapshot: FlowSnapshot,
  changes: FlowChanges
): string {
  // Get existing node and edge IDs for reference
  const existingNodeIds = flowSnapshot.nodes.map((n) => n.id);
  const existingEdgeIds = flowSnapshot.edges.map((e) => e.id);

  // Get new node IDs being added
  const newNodeIds = changes.actions
    .filter((a) => a.type === "addNode")
    .map((a) => (a as { node: { id: string } }).node.id);

  const allNodeIds = [...existingNodeIds, ...newNodeIds];

  return `You are a flow validation assistant. Evaluate whether these flow changes correctly implement the user's request.

## User Request
"${userRequest}"

## Current Flow State
Existing nodes: ${JSON.stringify(existingNodeIds)}
Existing edges: ${JSON.stringify(existingEdgeIds)}

Full snapshot:
${JSON.stringify(flowSnapshot, null, 2)}

## Proposed Changes
${JSON.stringify(changes, null, 2)}

## Validation Checklist

Check each item and report any issues:

1. **SEMANTIC MATCH**
   - Do the changes actually implement what the user asked for?
   - Are the node types appropriate (text-generation for text tasks, image-generation for images)?

2. **STRUCTURAL VALIDITY**
   - For addEdge: Do source and target node IDs exist in: ${JSON.stringify(allNodeIds)}?
   - Are data types correct? (string for text, image for images, response for preview-output)
   - Are node types valid? Must be one of: text-input, image-input, text-generation, image-generation, ai-logic, preview-output, react-component

3. **MODEL ID VALIDATION** (check provider/model pairs)
   - Valid text models: openai=${JSON.stringify(VALID_TEXT_MODELS.openai)}, google=${JSON.stringify(VALID_TEXT_MODELS.google)}, anthropic=${JSON.stringify(VALID_TEXT_MODELS.anthropic)}
   - Valid image models: openai=${JSON.stringify(VALID_IMAGE_MODELS.openai)}, google=${JSON.stringify(VALID_IMAGE_MODELS.google)}
   - Only flag if the model ID is NOT in the valid list for its provider

4. **DATA TYPE / TARGET HANDLE COMPATIBILITY** (CRITICAL)
   - Image data (dataType: "image") can ONLY connect to:
     - targetHandle: "image" on image-generation nodes (Base Image input) - THIS IS CORRECT!
     - preview-output nodes (targetHandle is optional for single-input nodes)
   - Image data CANNOT connect to text-only inputs:
     - targetHandle: "prompt" on text-generation nodes (User Prompt) - INVALID
     - targetHandle: "system" on text-generation nodes (System Instructions) - INVALID
     - targetHandle: "prompt" on image-generation nodes (Image Prompt) - INVALID (this is for TEXT prompts only)
   - String data (dataType: "string") can connect to any text input (prompt, system)

   IMPORTANT CLARIFICATIONS:
   - Connecting image data to targetHandle: "image" IS VALID - this is the correct way to do image-to-image transformation
   - Prompts can be set EITHER via node data.prompt OR via an edge connection - both are valid patterns
   - preview-output nodes have only one input, so targetHandle is OPTIONAL for edges targeting them
   - Do NOT flag as invalid if prompt is in node data instead of connected via edge

5. **COMPLETENESS** (CRITICAL)
   - Are new nodes connected via edges? Disconnected/orphaned nodes are INVALID
   - If adding multiple nodes, there MUST be edges connecting them
   - If inserting a node between existing nodes, was the old edge removed?
   - Does the flow maintain a path from input to output?
   - A flow with nodes but NO edges is INVALID

6. **OBVIOUS ISSUES**
   - Duplicate node or edge IDs?
   - Missing required fields (id, position, data for nodes)?
   - Edges referencing non-existent nodes?

## Response Format

Respond with ONLY valid JSON (no explanation, no markdown):
{"valid": true, "issues": [], "suggestions": []}

Or if there are REAL problems:
{"valid": false, "issues": ["Issue description"], "suggestions": ["Fix suggestion"]}

IMPORTANT - WHAT TO FLAG AS INVALID:
- Nodes with no edges connecting them = INVALID (disconnected flow)
- Multiple nodes added with zero edges = INVALID
- Image data connecting to text inputs (prompt/system handles) = INVALID
- Invalid model IDs = INVALID
- Edges referencing non-existent nodes = INVALID

THESE ARE ALL VALID (do NOT flag as errors):
- Image connecting to targetHandle: "image" on image-generation = VALID (base image input)
- Prompt set in node data.prompt instead of via edge = VALID
- Edge to preview-output without targetHandle = VALID (single input node)
- Image data going to preview-output = VALID`;
}

/**
 * Build a retry prompt that includes the validation errors.
 */
export function buildRetryContext(
  failedChanges: FlowChanges,
  evalResult: EvaluationResult
): string {
  return `
## IMPORTANT: Fix Previous Validation Errors

Your previous response failed validation. Here are the issues:

${evalResult.issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

Your previous (invalid) response was:
\`\`\`json
${JSON.stringify(failedChanges, null, 2)}
\`\`\`

Please generate CORRECTED FlowChanges that address these issues.

### Valid Model IDs (use EXACTLY these):
**Text Generation (text-generation, react-component):**
- OpenAI: gpt-5.2, gpt-5-mini, gpt-5-nano
- Google: gemini-3-pro-preview, gemini-3-flash-preview
- Anthropic: claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5

**Image Generation (image-generation):**
- OpenAI: gpt-image-1, dall-e-3, dall-e-2
- Google: gemini-2.5-flash-image, gemini-3-pro-image-preview

Double-check:
- All node IDs in edges must exist (either in the current flow or being created)
- Model IDs must be EXACTLY as listed above (e.g., "gemini-3-flash-preview" NOT "gemini-2.5-flash")
- Data types must match (string/image/response)
- New nodes must be connected to the flow
- If inserting between nodes, remove the old edge first

**CRITICAL - Image connections:**
- Image data (dataType: "image") can ONLY connect to:
  - targetHandle: "image" on image-generation nodes (Base Image)
  - preview-output nodes
- Image data CANNOT connect to text inputs (targetHandle: "prompt" or "system")`;
}
