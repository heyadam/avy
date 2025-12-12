"use client";

import { useState } from "react";
import { nodeDefinitions, type NodeType } from "@/types/flow";
import { Play, Square, MessageSquare, Plus, X } from "lucide-react";
import type { DragEvent } from "react";
import { Button } from "@/components/ui/button";

const iconMap = {
  input: Play,
  output: Square,
  prompt: MessageSquare,
};

export function NodeSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <>
      {/* Add Node Button */}
      <div className="absolute top-4 left-4 z-10">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant={isOpen ? "secondary" : "default"}
          size="sm"
          className="gap-2"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isOpen ? "Close" : "Add Node"}
        </Button>
      </div>

      {/* Sliding Panel */}
      <aside
        className={`absolute top-16 left-4 z-10 w-64 border rounded-xl bg-background/95 backdrop-blur shadow-lg transition-all duration-200 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="p-3 border-b">
          <div className="text-sm font-semibold">Node Palette</div>
          <div className="text-xs text-muted-foreground mt-0.5">Drag nodes onto the canvas</div>
        </div>

        <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
          {nodeDefinitions.map((node) => {
            const Icon = iconMap[node.type];
            return (
              <div
                key={node.type}
                draggable
                onDragStart={(e) => onDragStart(e, node.type)}
                className="group flex items-center gap-3 p-2.5 border rounded-lg cursor-grab hover:bg-muted/40 hover:border-border/70 transition-colors active:cursor-grabbing"
              >
                <div className={`p-1.5 ${node.color} rounded-md border border-border/60`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{node.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{node.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
