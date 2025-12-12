"use client";

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

// Color mapping based on data type
const edgeColors = {
  string: "#06b6d4", // cyan-500
  image: "#a855f7",  // purple-500
  response: "#f59e0b", // amber-500
  default: "#6b7280", // gray-500
};

export function ColoredEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const dataType = (data?.dataType as string) || "default";
  const strokeColor = edgeColors[dataType as keyof typeof edgeColors] || edgeColors.default;

  return (
    <>
      {/* Outer glow when selected */}
      {selected && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={16}
            strokeOpacity={0.15}
            className="animate-pulse"
          />
          <path
            d={edgePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={10}
            strokeOpacity={0.3}
            className="animate-pulse"
          />
          <path
            d={edgePath}
            fill="none"
            stroke="#ffffff"
            strokeWidth={6}
            strokeOpacity={0.4}
          />
        </>
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 4 : 2,
        }}
      />
    </>
  );
}

export const edgeTypes = {
  colored: ColoredEdge,
};
