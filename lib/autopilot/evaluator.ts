import type { FlowSnapshot, FlowChanges, EvaluationResult, AddNodeAction } from "./types";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface EvaluatorOptions {
  userRequest: string;
  flowSnapshot: FlowSnapshot;
  changes: FlowChanges;
  apiKey?: string;
}

// Valid model IDs - used for programmatic validation
const VALID_TEXT_MODELS: Record<string, string[]> = {
  openai: ["gpt-5.2", "gpt-5-mini", "gpt-5-nano"],
  google: ["gemini-3-pro-preview", "gemini-3-flash-preview"],
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
};

const VALID_IMAGE_MODELS: Record<string, string[]> = {
  openai: ["gpt-image-1", "dall-e-3", "dall-e-2"],
  google: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "imagen-4.0-generate-001", "imagen-4.0-ultra-generate-001", "imagen-4.0-fast-generate-001"],
};

/**
 * Programmatically validate model IDs in the changes.
 * Returns array of issues found.
 */
function validateModelIds(changes: FlowChanges): string[] {
  const issues: string[] = [];

  for (const action of changes.actions) {
    if (action.type === "addNode") {
      const node = (action as AddNodeAction).node;
      const nodeType = node.type;
      const data = node.data as { provider?: string; model?: string; label?: string };

      if (!data.provider || !data.model) continue;

      const provider = data.provider.toLowerCase();
      const model = data.model;
      const label = data.label || node.id;

      if (nodeType === "text-generation" || nodeType === "react-component") {
        const validModels = VALID_TEXT_MODELS[provider];
        if (validModels && !validModels.includes(model)) {
          issues.push(`Node "${label}": Invalid model ID "${model}" for provider "${provider}". Valid models: ${validModels.join(", ")}`);
        }
      } else if (nodeType === "image-generation") {
        const validModels = VALID_IMAGE_MODELS[provider];
        if (validModels && !validModels.includes(model)) {
          issues.push(`Node "${label}": Invalid model ID "${model}" for provider "${provider}". Valid models: ${validModels.join(", ")}`);
        }
      }
    }
  }

  return issues;
}

/**
 * Evaluate flow changes using Claude Sonnet for validation.
 * Model IDs are validated programmatically first, then LLM checks semantics and structure.
 */
export async function evaluateFlowChanges(
  options: EvaluatorOptions
): Promise<EvaluationResult> {
  const { userRequest, flowSnapshot, changes, apiKey } = options;

  // First, do programmatic model ID validation
  const modelIdIssues = validateModelIds(changes);

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

    const llmResult = parseEvaluationResponse(result.text);

    // Combine programmatic issues with LLM issues
    const allIssues = [...modelIdIssues, ...llmResult.issues];

    return {
      valid: allIssues.length === 0,
      issues: allIssues,
      suggestions: llmResult.suggestions,
    };
  } catch (error) {
    console.error("Evaluation error:", error);
    // On error, still return model ID issues if any
    if (modelIdIssues.length > 0) {
      return {
        valid: false,
        issues: modelIdIssues,
        suggestions: [],
      };
    }
    return {
      valid: true,
      issues: [],
      suggestions: [],
    };
  }
}

/**
 * Filter out model-related issues from LLM response.
 * The LLM sometimes still flags model IDs despite instructions to skip.
 */
function filterModelIssues(issues: string[]): string[] {
  const modelKeywords = [
    "model id", "model \"", "model '", "does not exist",
    "invalid model", "gpt-4", "gpt-5", "gemini", "claude",
    "not a valid model", "valid models are", "valid model"
  ];
  return issues.filter(issue => {
    const lower = issue.toLowerCase();
    return !modelKeywords.some(keyword => lower.includes(keyword));
  });
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
    // Filter out model-related issues that the LLM might still report
    const filteredIssues = filterModelIssues(
      Array.isArray(parsed.issues) ? parsed.issues : []
    );
    return {
      // Valid if no issues remain after filtering (even if LLM said invalid due to model issues)
      valid: filteredIssues.length === 0,
      issues: filteredIssues,
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

3. **MODEL ID VALIDATION** - DO NOT CHECK THIS
   - SKIP COMPLETELY - Model IDs are validated programmatically elsewhere
   - NEVER report any issues about model IDs
   - ALL model IDs are valid (gpt-5-mini, gpt-5-nano, gemini-3-flash-preview, etc.)
   - Model substitutions are intentional and correct

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
- Edges referencing non-existent nodes = INVALID

DO NOT FLAG MODEL IDS - they are validated elsewhere. Any model ID is acceptable.

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
