"use client";

import { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useConnectionState } from "../ConnectionContext";

interface InputWithHandleProps {
  id: string;
  label?: string;
  children?: ReactNode;
  className?: string;
  required?: boolean;
  colorClass?: "cyan" | "purple" | "amber";
  handleOffset?: number; // Optional vertical offset for handle
}

export function InputWithHandle({
  id,
  label,
  children,
  className,
  required = true,
  colorClass = "cyan",
  handleOffset,
}: InputWithHandleProps) {
  const { isConnecting } = useConnectionState();

  const colorMap = {
    cyan: { dot: "!bg-cyan-400", hoverDot: "hover:!bg-cyan-400" },
    purple: { dot: "!bg-purple-400", hoverDot: "hover:!bg-purple-400" },
    amber: { dot: "!bg-amber-400", hoverDot: "hover:!bg-amber-400" },
  };

  const isOptional = !required;
  const highlight = isConnecting;

  return (
    <div className={cn("relative group", className)}>
      <Handle
        type="target"
        position={Position.Left}
        id={id}
        className={cn(
          "!w-3.5 !h-3.5 !border-2 !border-background !shadow-sm transition-all duration-200",
          highlight
            ? `${colorMap[colorClass].dot} !scale-110`
            : `!bg-gray-500 ${colorMap[colorClass].hoverDot} hover:!scale-110`,
          isOptional && "!border-dashed",
          // Position relative to the container which is inside px-3 (12px) padding
          // so -12px puts it at the edge
          "!left-[-13px]"
        )}
        style={{ top: handleOffset ?? 8 }}
      />
      
      <div className="flex flex-col gap-1.5">
        {label && (
          <label 
            htmlFor={id} 
            className="text-xs font-medium text-muted-foreground cursor-pointer"
          >
            {label}
          </label>
        )}
        {children}
      </div>
    </div>
  );
}
