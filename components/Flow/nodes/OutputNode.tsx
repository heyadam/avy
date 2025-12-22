"use client";

import { useReactFlow, useEdges, type NodeProps, type Node } from "@xyflow/react";
import type { OutputNodeData } from "@/types/flow";
import { Square } from "lucide-react";
import { NodeFrame } from "./NodeFrame";
import { PortRow } from "./PortLabel";
import { isImageOutput, parseImageOutput, getImageDataUrl } from "@/lib/image-utils";

type OutputNodeType = Node<OutputNodeData, "preview-output">;

export function OutputNode({ id, data }: NodeProps<OutputNodeType>) {
  const { updateNodeData } = useReactFlow();
  const edges = useEdges();

  // Check if input is connected (handle undefined when default handle is used)
  const isInputConnected = edges.some(
    (edge) => edge.target === id && (edge.targetHandle === "input" || !edge.targetHandle)
  );

  const renderFooter = () => {
    if (data.executionError) {
      return (
        <p className="text-xs text-destructive whitespace-pre-wrap line-clamp-4">
          {data.executionError}
        </p>
      );
    }

    if (data.executionOutput) {
      // Show image thumbnail preview
      if (isImageOutput(data.executionOutput)) {
        const imageData = parseImageOutput(data.executionOutput);
        if (imageData) {
          return (
            <div className="rounded-md overflow-hidden border border-border/50">
              <img
                src={getImageDataUrl(imageData)}
                alt="Generated image"
                className="w-full h-auto max-h-[160px] object-contain bg-muted/30"
              />
            </div>
          );
        }
      }

      return (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {data.executionOutput}
        </p>
      );
    }

    return (
      <p className="text-xs text-muted-foreground">Output appears here</p>
    );
  };

  return (
    <NodeFrame
      title={data.label}
      onTitleChange={(label) => updateNodeData(id, { label })}
      icon={<Square className="h-4 w-4" />}
      iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-300"
      accentBorderClassName="border-blue-500"
      status={data.executionStatus}
      className="w-[280px]"
      ports={
        <PortRow
          nodeId={id}
          input={{ id: "input", label: "Image or String", colorClass: "amber", isConnected: isInputConnected }}
        />
      }
      footer={renderFooter()}
    />
  );
}
