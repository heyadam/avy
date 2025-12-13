"use client";

import { Handle, Position } from "@xyflow/react";
import { HANDLE_STYLE } from "@/lib/constants";

export interface NodeHandleProps {
  /** Handle type: "target" (input) or "source" (output) */
  type: "target" | "source";
  /** Position: Left for target, Right for source */
  position: Position;
  /** Label to display next to the handle */
  label: string;
}

/**
 * Reusable handle component with consistent styling and label.
 */
export function NodeHandle({ type, position, label }: NodeHandleProps) {
  const isLeft = position === Position.Left;
  const labelOffset = isLeft ? "-left-12" : "-right-11";

  return (
    <>
      <Handle
        type={type}
        position={position}
        className={HANDLE_STYLE.BASE_CLASS}
      />
      <div
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${labelOffset}`}
      >
        <span className="rounded-md bg-gray-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm">
          {label}
        </span>
      </div>
    </>
  );
}
