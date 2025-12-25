import { PROVIDERS, DEFAULT_VISION_MODELS, type ProviderId } from "@/lib/providers";
import { parseImageOutput, type ImageData } from "@/lib/image-utils";

/**
 * Check if a specific model supports vision (multimodal input)
 */
export function modelSupportsVision(provider: ProviderId, model: string): boolean {
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) return false;
  const modelConfig = providerConfig.models.find((m: { value: string }) => m.value === model);
  return (modelConfig as { supportsVision?: boolean })?.supportsVision ?? false;
}

/**
 * Get the default vision-capable model for a provider
 */
export function getDefaultVisionModel(provider: ProviderId): string | null {
  return DEFAULT_VISION_MODELS[provider] ?? null;
}

/**
 * Get a vision-capable model for the provider.
 * Returns current model if it supports vision, otherwise falls back to default.
 */
export function getVisionCapableModel(provider: ProviderId, currentModel: string): string | null {
  // Return current if it supports vision
  if (modelSupportsVision(provider, currentModel)) {
    return currentModel;
  }
  // Fall back to default vision model (may be null if provider has none)
  return getDefaultVisionModel(provider);
}

/**
 * Resolve image from connection or inline - connection wins if non-empty
 */
export function resolveImageInput(
  connectedImage: string | undefined,
  inlineImage: string | undefined
): ImageData | null {
  const imageSource = (connectedImage && connectedImage.trim()) || inlineImage;
  if (!imageSource) return null;
  return parseImageOutput(imageSource);
}
