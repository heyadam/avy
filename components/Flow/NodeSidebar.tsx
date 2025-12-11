"use client";

import { nodeDefinitions, type NodeType } from "@/types/flow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Square, MessageSquare, Wrench, GitBranch } from "lucide-react";
import type { DragEvent } from "react";

const iconMap = {
  input: Play,
  output: Square,
  prompt: MessageSquare,
  tool: Wrench,
  condition: GitBranch,
};

export function NodeSidebar() {
  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Card className="w-64 h-full border-r rounded-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Node Palette</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {nodeDefinitions.map((node) => {
          const Icon = iconMap[node.type];
          return (
            <div
              key={node.type}
              draggable
              onDragStart={(e) => onDragStart(e, node.type)}
              className="flex items-center gap-3 p-3 border rounded-lg cursor-grab hover:bg-muted/50 transition-colors active:cursor-grabbing"
            >
              <div className={`p-1.5 ${node.color} rounded text-white`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{node.label}</p>
                <p className="text-xs text-muted-foreground truncate">{node.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
