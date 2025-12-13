"use client";

import { Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import type { PromptNodeData } from "@/types/flow";
import { MessageSquare } from "lucide-react";
import { NodeFrame } from "./NodeFrame";
import { NodeSelect } from "./NodeSelect";
import { NodeHandle } from "./NodeHandle";
import { cn } from "@/lib/utils";
import { CSS_CLASSES } from "@/lib/constants";
import {
  PROVIDERS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  VERBOSITY_OPTIONS,
  THINKING_OPTIONS,
  type ProviderId,
} from "@/lib/providers";

type PromptNodeType = Node<PromptNodeData, "prompt">;

export function PromptNode({ id, data }: NodeProps<PromptNodeType>) {
  const { updateNodeData } = useReactFlow();

  const currentProvider = (data.provider || DEFAULT_PROVIDER) as ProviderId;
  const providerConfig = PROVIDERS[currentProvider];
  const currentModel = data.model || DEFAULT_MODEL;
  const currentModelConfig = providerConfig.models.find((m) => m.value === currentModel);

  const handleProviderChange = (provider: string) => {
    const newProvider = provider as ProviderId;
    const firstModel = PROVIDERS[newProvider].models[0];
    updateNodeData(id, { provider: newProvider, model: firstModel.value, label: firstModel.label });
  };

  const handleModelChange = (model: string) => {
    const modelConfig = providerConfig.models.find((m) => m.value === model);
    updateNodeData(id, { model, label: modelConfig?.label || model });
  };

  // Build provider options from PROVIDERS config
  const providerOptions = Object.entries(PROVIDERS).map(([key, provider]) => ({
    value: key,
    label: provider.label,
  }));

  // Build model options from current provider
  const modelOptions = providerConfig.models.map((m) => ({
    value: m.value,
    label: m.label,
  }));

  return (
    <NodeFrame
      title={data.label}
      onTitleChange={(label) => updateNodeData(id, { label })}
      icon={<MessageSquare className="h-4 w-4" />}
      iconClassName="bg-gray-500/10 text-gray-600 dark:text-gray-300"
      accentBorderClassName=""
      status={data.executionStatus}
      className="w-[240px]"
      footer={
        data.executionError ? (
          <p className="text-xs text-destructive whitespace-pre-wrap line-clamp-4">
            {data.executionError}
          </p>
        ) : data.executionOutput ? (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
            {data.executionOutput}
          </p>
        ) : null
      }
    >
      <NodeHandle type="target" position={Position.Left} label="string" />

      <div className="space-y-2">
        <textarea
          value={typeof data.prompt === "string" ? data.prompt : ""}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="System instructions (optional)…"
          className={cn(
            `${CSS_CLASSES.NO_DRAG} w-full min-h-[84px] resize-y rounded-md border border-input bg-background/60 dark:bg-muted/40 px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none`,
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          )}
        />

        <NodeSelect
          label="Provider"
          value={currentProvider}
          onValueChange={handleProviderChange}
          options={providerOptions}
          width="120px"
        />

        <NodeSelect
          label="Model"
          value={currentModel}
          onValueChange={handleModelChange}
          options={modelOptions}
          width="120px"
        />

        {currentModelConfig?.supportsVerbosity && (
          <NodeSelect
            label="Verbosity"
            value={data.verbosity || "medium"}
            onValueChange={(verbosity) => updateNodeData(id, { verbosity })}
            options={[...VERBOSITY_OPTIONS]}
            width="120px"
          />
        )}

        {currentModelConfig?.supportsThinking && (
          <NodeSelect
            label="Thinking"
            value={data.thinking ? "on" : "off"}
            onValueChange={(val) => updateNodeData(id, { thinking: val === "on" })}
            options={[...THINKING_OPTIONS]}
            width="120px"
          />
        )}
      </div>

      <NodeHandle type="source" position={Position.Right} label="string" />
    </NodeFrame>
  );
}
