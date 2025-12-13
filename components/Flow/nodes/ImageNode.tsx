"use client";

import { Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import type { ImageNodeData } from "@/types/flow";
import { ImageIcon } from "lucide-react";
import { NodeFrame } from "./NodeFrame";
import { NodeSelect } from "./NodeSelect";
import { NodeHandle } from "./NodeHandle";
import { cn } from "@/lib/utils";
import { CSS_CLASSES } from "@/lib/constants";
import {
  IMAGE_PROVIDERS,
  DEFAULT_IMAGE_PROVIDER,
  DEFAULT_IMAGE_MODEL,
  ASPECT_RATIO_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  SIZE_OPTIONS,
  QUALITY_OPTIONS,
  PARTIAL_IMAGES_OPTIONS,
  type ImageProviderId,
} from "@/lib/providers";
import { parseImageOutput, getImageDataUrl } from "@/lib/image-utils";

type ImageNodeType = Node<ImageNodeData, "image">;

export function ImageNode({ id, data }: NodeProps<ImageNodeType>) {
  const { updateNodeData } = useReactFlow();

  const currentProvider = (data.provider || DEFAULT_IMAGE_PROVIDER) as ImageProviderId;
  const providerConfig = IMAGE_PROVIDERS[currentProvider];
  const currentModel = data.model || DEFAULT_IMAGE_MODEL;
  const currentModelConfig = providerConfig.models.find((m) => m.value === currentModel);

  const handleProviderChange = (provider: string) => {
    const newProvider = provider as ImageProviderId;
    const firstModel = IMAGE_PROVIDERS[newProvider].models[0];
    updateNodeData(id, { provider: newProvider, model: firstModel.value, label: firstModel.label });
  };

  const handleModelChange = (model: string) => {
    const modelConfig = providerConfig.models.find((m) => m.value === model);
    updateNodeData(id, { model, label: modelConfig?.label || model });
  };

  // Build provider options from IMAGE_PROVIDERS config
  const providerOptions = Object.entries(IMAGE_PROVIDERS).map(([key, provider]) => ({
    value: key,
    label: provider.label,
  }));

  // Build model options from current provider
  const modelOptions = providerConfig.models.map((m) => ({
    value: m.value,
    label: m.label,
  }));

  // Render image footer using shared utilities
  const renderFooter = () => {
    if (data.executionError) {
      return (
        <p className="text-xs text-destructive whitespace-pre-wrap line-clamp-4">
          {data.executionError}
        </p>
      );
    }

    if (data.executionOutput) {
      const imageData = parseImageOutput(data.executionOutput);
      if (imageData) {
        return (
          <div
            className="w-full rounded overflow-hidden bg-muted/20"
            style={{ minHeight: "80px" }}
          >
            <img
              src={getImageDataUrl(imageData)}
              alt="Generated"
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "120px",
                objectFit: "cover",
                display: "block"
              }}
            />
          </div>
        );
      }
      // Not image data, show as text
      return (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {data.executionOutput}
        </p>
      );
    }

    return null;
  };

  return (
    <NodeFrame
      title={data.label}
      onTitleChange={(label) => updateNodeData(id, { label })}
      icon={<ImageIcon className="h-4 w-4" />}
      iconClassName="bg-gray-500/10 text-gray-600 dark:text-gray-300"
      accentBorderClassName=""
      status={data.executionStatus}
      className="w-[240px]"
      footer={renderFooter()}
    >
      <NodeHandle type="target" position={Position.Left} label="string" />

      <div className="space-y-2">
        <textarea
          value={typeof data.prompt === "string" ? data.prompt : ""}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="Additional instructions (optional)…"
          className={cn(
            `${CSS_CLASSES.NO_DRAG} w-full min-h-[60px] resize-y rounded-md border border-input bg-background/60 dark:bg-muted/40 px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none`,
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          )}
        />

        <NodeSelect
          label="Provider"
          value={currentProvider}
          onValueChange={handleProviderChange}
          options={providerOptions}
        />

        <NodeSelect
          label="Model"
          value={currentModel}
          onValueChange={handleModelChange}
          options={modelOptions}
        />

        {/* OpenAI-specific options */}
        {currentProvider === "openai" && (
          <>
            <NodeSelect
              label="Format"
              value={data.outputFormat || "webp"}
              onValueChange={(outputFormat) => updateNodeData(id, { outputFormat })}
              options={[...OUTPUT_FORMAT_OPTIONS]}
            />

            <NodeSelect
              label="Size"
              value={data.size || "1024x1024"}
              onValueChange={(size) => updateNodeData(id, { size })}
              options={[...SIZE_OPTIONS]}
            />

            <NodeSelect
              label="Quality"
              value={data.quality || "low"}
              onValueChange={(quality) => updateNodeData(id, { quality })}
              options={[...QUALITY_OPTIONS]}
            />

            {currentModelConfig?.supportsPartialImages && (
              <NodeSelect
                label="Partials"
                value={String(data.partialImages ?? 3)}
                onValueChange={(val) => updateNodeData(id, { partialImages: Number(val) })}
                options={[...PARTIAL_IMAGES_OPTIONS]}
              />
            )}
          </>
        )}

        {/* Google-specific options */}
        {currentProvider === "google" && (
          <NodeSelect
            label="Aspect"
            value={data.aspectRatio || "1:1"}
            onValueChange={(aspectRatio) => updateNodeData(id, { aspectRatio })}
            options={[...ASPECT_RATIO_OPTIONS]}
          />
        )}
      </div>

      <NodeHandle type="source" position={Position.Right} label="image" />
    </NodeFrame>
  );
}
