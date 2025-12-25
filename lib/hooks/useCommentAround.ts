import { useCallback, useMemo } from "react";
import type { Node } from "@xyflow/react";
import type { CommentColor } from "@/types/flow";

const COMMENT_PADDING = 40;
const COMMENT_HEADER_HEIGHT = 60;
const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 200;

interface UseCommentAroundOptions {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  triggerGeneration: (commentId: string) => void;
  getId: () => string;
  onBeforeChange?: () => void;
}

interface UseCommentAroundResult {
  hasSelection: boolean;
  handleCommentAround: () => void;
}

/**
 * Hook for wrapping selected nodes in a comment box.
 * Creates a comment node sized to contain all selected nodes,
 * then parents the selected nodes to the comment.
 */
export function useCommentAround({
  nodes,
  setNodes,
  triggerGeneration,
  getId,
  onBeforeChange,
}: UseCommentAroundOptions): UseCommentAroundResult {
  // Get selected nodes (excluding comments) - computed once per nodes change
  const selectedNodes = useMemo(
    () => nodes.filter((n) => n.selected && n.type !== "comment"),
    [nodes]
  );

  const hasSelection = selectedNodes.length > 0;

  // Handler to create comment around selected nodes
  const handleCommentAround = useCallback(() => {
    if (selectedNodes.length === 0) return;

    // Snapshot for undo support
    onBeforeChange?.();

    // Calculate bounding box of selected nodes
    const bounds = selectedNodes.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x + (node.measured?.width || DEFAULT_NODE_WIDTH)),
        maxY: Math.max(acc.maxY, node.position.y + (node.measured?.height || DEFAULT_NODE_HEIGHT)),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    const commentId = getId();
    const commentPosition = {
      x: bounds.minX - COMMENT_PADDING,
      y: bounds.minY - COMMENT_PADDING - COMMENT_HEADER_HEIGHT,
    };

    // Create comment node with default values
    const commentNode: Node = {
      id: commentId,
      type: "comment",
      position: commentPosition,
      style: {
        width: bounds.maxX - bounds.minX + COMMENT_PADDING * 2,
        height: bounds.maxY - bounds.minY + COMMENT_PADDING * 2 + COMMENT_HEADER_HEIGHT,
        zIndex: -1, // Render behind other nodes
      },
      data: {
        label: "Comment",
        description: "",
        color: "gray" as CommentColor,
      },
    };

    // Capture selected node IDs for stable reference in setNodes callback
    const selectedIds = new Set(selectedNodes.map((n) => n.id));

    // Update selected nodes to be children of comment
    setNodes((nds) => [
      commentNode,
      ...nds.map((node) =>
        selectedIds.has(node.id)
          ? {
              ...node,
              parentId: commentId,
              // Convert absolute position to relative within parent
              position: {
                x: node.position.x - commentPosition.x,
                y: node.position.y - commentPosition.y,
              },
            }
          : node
      ),
    ]);

    // Trigger AI generation for the new comment's title/description
    triggerGeneration(commentId);
  }, [selectedNodes, setNodes, triggerGeneration, getId, onBeforeChange]);

  return {
    hasSelection,
    handleCommentAround,
  };
}
