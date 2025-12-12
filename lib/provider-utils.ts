/**
 * Provider utility functions
 *
 * Shared logic for handling provider and model selection across node types.
 * Used by PromptNode and ImageNode components.
 */

import {
  PROVIDERS,
  IMAGE_PROVIDERS,
  type ProviderId,
  type ImageProviderId,
} from "./providers";

// Define the shape of a provider entry
interface ProviderEntry {
  label: string;
  models: readonly { value: string; label: string; [key: string]: unknown }[];
}

// Provider config is a record of provider IDs to provider entries
type ProviderConfig = Record<string, ProviderEntry>;

interface UpdateNodeDataFn {
  (id: string, data: Record<string, unknown>): void;
}

/**
 * Get provider configuration and current model config
 */
export function getProviderConfig(
  providers: ProviderConfig,
  currentProvider: string,
  currentModel: string
) {
  const providerConfig = providers[currentProvider];
  const models = providerConfig.models;
  const currentModelConfig = models.find((m) => m.value === currentModel);

  return {
    providerConfig,
    currentModelConfig,
    models,
  };
}

/**
 * Create a provider change handler for prompt nodes
 */
export function createPromptProviderChangeHandler(
  id: string,
  updateNodeData: UpdateNodeDataFn
) {
  return (provider: string) => {
    const newProvider = provider as ProviderId;
    const firstModel = PROVIDERS[newProvider].models[0];
    updateNodeData(id, {
      provider: newProvider,
      model: firstModel.value,
      label: firstModel.label,
    });
  };
}

/**
 * Create a provider change handler for image nodes
 */
export function createImageProviderChangeHandler(
  id: string,
  updateNodeData: UpdateNodeDataFn
) {
  return (provider: string) => {
    const newProvider = provider as ImageProviderId;
    const firstModel = IMAGE_PROVIDERS[newProvider].models[0];
    updateNodeData(id, {
      provider: newProvider,
      model: firstModel.value,
      label: firstModel.label,
    });
  };
}

/**
 * Create a model change handler
 */
export function createModelChangeHandler(
  id: string,
  providers: ProviderConfig,
  currentProvider: string,
  updateNodeData: UpdateNodeDataFn
) {
  return (model: string) => {
    const providerConfig = providers[currentProvider];
    const models = providerConfig.models;
    const modelConfig = models.find((m) => m.value === model);
    updateNodeData(id, { model, label: modelConfig?.label || model });
  };
}

/**
 * Create a generic option change handler
 */
export function createOptionChangeHandler(
  id: string,
  updateNodeData: UpdateNodeDataFn,
  optionKey: string,
  transform?: (value: string) => unknown
) {
  return (value: string) => {
    const transformedValue = transform ? transform(value) : value;
    updateNodeData(id, { [optionKey]: transformedValue });
  };
}
