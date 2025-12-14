"use client";

import { ConfigSelect } from "./ConfigSelect";

// Generic model config - all model configs must have at least these fields
export interface BaseModelConfig {
  value: string;
  label: string;
}

// Generic provider config
export interface BaseProviderConfig {
  label: string;
  models: readonly BaseModelConfig[];
}

// Generic providers map - each provider can have its own model config shape
export type ProvidersMap = Record<string, BaseProviderConfig>;

interface ProviderModelSelectorProps {
  providers: ProvidersMap;
  currentProvider: string;
  currentModel: string;
  onProviderChange: (provider: string, firstModel: BaseModelConfig) => void;
  onModelChange: (model: string, modelConfig: BaseModelConfig | undefined) => void;
  width?: string;
}

/**
 * Reusable provider and model selector dropdowns.
 * Works with any provider config (PROVIDERS, IMAGE_PROVIDERS, etc.)
 */
export function ProviderModelSelector({
  providers,
  currentProvider,
  currentModel,
  onProviderChange,
  onModelChange,
  width = "w-[100px]",
}: ProviderModelSelectorProps) {
  const providerConfig = providers[currentProvider];

  const providerOptions = Object.entries(providers).map(([key, config]) => ({
    value: key,
    label: config.label,
  }));

  const modelOptions = providerConfig?.models.map((m) => ({
    value: m.value,
    label: m.label,
  })) ?? [];

  const handleProviderChange = (provider: string) => {
    const newProviderConfig = providers[provider];
    const firstModel = newProviderConfig.models[0];
    onProviderChange(provider, firstModel);
  };

  const handleModelChange = (model: string) => {
    const modelConfig = providerConfig?.models.find((m) => m.value === model);
    onModelChange(model, modelConfig);
  };

  return (
    <>
      <ConfigSelect
        label="Provider"
        value={currentProvider}
        options={providerOptions}
        onChange={handleProviderChange}
        width={width}
      />
      <ConfigSelect
        label="Model"
        value={currentModel}
        options={modelOptions}
        onChange={handleModelChange}
        width={width}
      />
    </>
  );
}
