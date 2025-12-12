/**
 * Image output utility functions
 *
 * Centralized utilities for handling image output data from AI generation nodes.
 * Used by OutputNode, ImageNode, and ResponsesContent components.
 */

export interface ImageData {
  type: "image";
  value: string;
  mimeType: string;
}

/**
 * Check if output string contains JSON image data
 */
export function isImageOutput(output?: string): boolean {
  if (!output) return false;
  try {
    const parsed = JSON.parse(output);
    return parsed.type === "image" && !!parsed.value;
  } catch {
    return false;
  }
}

/**
 * Parse image data from JSON output string
 * Returns null if output is not valid image data
 */
export function parseImageOutput(output: string): ImageData | null {
  try {
    const parsed = JSON.parse(output);
    if (parsed.type === "image" && parsed.value) {
      return {
        type: "image",
        value: parsed.value,
        mimeType: parsed.mimeType || "image/png",
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a data URL from image data for rendering in img tags
 */
export function getImageDataUrl(imageData: ImageData): string {
  return `data:${imageData.mimeType};base64,${imageData.value}`;
}

/**
 * Stringify image data for storage/transmission
 */
export function stringifyImageOutput(imageData: ImageData): string {
  return JSON.stringify({
    type: imageData.type,
    value: imageData.value,
    mimeType: imageData.mimeType,
  });
}
