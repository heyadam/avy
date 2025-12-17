/**
 * React component output utility functions
 *
 * Centralized utilities for handling React component output data from generation nodes.
 * Used by ReactNode and ResponsesContent components.
 */

export interface ReactComponentData {
  type: "react";
  code: string;
}

/**
 * Check if output string contains JSON React component data
 */
export function isReactOutput(output?: string): boolean {
  if (!output) return false;
  try {
    const parsed = JSON.parse(output);
    return parsed.type === "react" && !!parsed.code;
  } catch {
    return false;
  }
}

/**
 * Parse React component data from JSON output string
 * Returns null if output is not valid React component data
 */
export function parseReactOutput(output: string): ReactComponentData | null {
  try {
    const parsed = JSON.parse(output);
    if (parsed.type === "react" && parsed.code) {
      return {
        type: "react",
        code: parsed.code,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Stringify React component data for storage/transmission
 */
export function stringifyReactOutput(code: string): string {
  return JSON.stringify({
    type: "react",
    code,
  });
}

/**
 * Extract code from LLM response (strips markdown fences if present)
 */
export function extractReactCode(response: string): string {
  // Try to extract from markdown code blocks
  const codeBlockMatch = response.match(
    /```(?:jsx|tsx|javascript|js|react)?\s*\n?([\s\S]*?)\n?```/
  );
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // Return as-is if no code blocks found
  return response.trim();
}
