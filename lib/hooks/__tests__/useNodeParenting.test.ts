import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNodeParenting, getAbsolutePosition, isInsideComment, findSmallestContainingComment } from "../useNodeParenting";
import type { Node, NodeChange } from "@xyflow/react";

describe("useNodeParenting", () => {
  const mockSetNodes = vi.fn();
  const mockOnNodesChange = vi.fn();
  const mockTriggerGeneration = vi.fn();
  const mockClearHighlightOnDrag = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createComment = (id: string, x: number, y: number, width = 300, height = 200): Node => ({
    id,
    type: "comment",
    position: { x, y },
    style: { width, height },
    data: { label: "Comment", description: "", color: "gray" },
  });

  const createNode = (id: string, x: number, y: number, parentId?: string): Node => ({
    id,
    type: "text-generation",
    position: { x, y },
    parentId,
    data: { label: "Node" },
  });

  describe("getAbsolutePosition", () => {
    it("should return position for node without parent", () => {
      const node = createNode("node_1", 100, 200);
      const nodes = [node];

      const pos = getAbsolutePosition(node, nodes);

      expect(pos).toEqual({ x: 100, y: 200 });
    });

    it("should add parent position for child node", () => {
      const comment = createComment("comment_1", 50, 50);
      const child = createNode("node_1", 100, 100, "comment_1");
      const nodes = [comment, child];

      const pos = getAbsolutePosition(child, nodes);

      expect(pos).toEqual({ x: 150, y: 150 }); // 50+100, 50+100
    });

    it("should handle nested parents", () => {
      const outerComment = createComment("outer", 10, 10);
      const innerComment = { ...createComment("inner", 20, 20), parentId: "outer" };
      const child = createNode("node_1", 30, 30, "inner");
      const nodes = [outerComment, innerComment, child];

      const pos = getAbsolutePosition(child, nodes);

      expect(pos).toEqual({ x: 60, y: 60 }); // 10+20+30
    });
  });

  describe("isInsideComment", () => {
    it("should return true when point is inside comment", () => {
      const comment = createComment("comment_1", 0, 0, 300, 200);
      const nodes = [comment];

      // Point at (50, 50) + 40px offset = (90, 90) - should be inside
      const result = isInsideComment({ x: 50, y: 50 }, comment, nodes);

      expect(result).toBe(true);
    });

    it("should return false when point is outside comment", () => {
      const comment = createComment("comment_1", 0, 0, 100, 100);
      const nodes = [comment];

      // Point at (200, 200) + 40px = (240, 240) - outside 100x100 comment
      const result = isInsideComment({ x: 200, y: 200 }, comment, nodes);

      expect(result).toBe(false);
    });

    it("should handle comment with parent", () => {
      const parentComment = createComment("parent", 100, 100);
      const childComment = { ...createComment("child", 50, 50, 200, 150), parentId: "parent" };
      const nodes = [parentComment, childComment];

      // Child comment absolute position is (150, 150) with size 200x150
      // Point at (160, 160) + 40px = (200, 200) - should be inside child
      const result = isInsideComment({ x: 160, y: 160 }, childComment, nodes);

      expect(result).toBe(true);
    });
  });

  describe("findSmallestContainingComment", () => {
    it("should find the smallest comment containing the point", () => {
      const largeComment = createComment("large", 0, 0, 500, 500);
      const smallComment = createComment("small", 100, 100, 100, 100);
      const nodes = [largeComment, smallComment];
      const comments = [largeComment, smallComment];

      // Point at (110, 110) - inside both, should pick smaller
      const result = findSmallestContainingComment({ x: 110, y: 110 }, comments, nodes);

      expect(result?.id).toBe("small");
    });

    it("should return null when no comment contains the point", () => {
      const comment = createComment("comment_1", 0, 0, 100, 100);
      const nodes = [comment];
      const comments = [comment];

      const result = findSmallestContainingComment({ x: 500, y: 500 }, comments, nodes);

      expect(result).toBeNull();
    });
  });

  describe("handleNodesChange - comment deletion", () => {
    it("should unparent children when comment is deleted", () => {
      const comment = createComment("comment_1", 100, 100);
      const child = createNode("node_1", 50, 50, "comment_1");
      const nodes = [comment, child];

      const changes: NodeChange<Node>[] = [
        { type: "remove", id: "comment_1" },
      ];

      const { result } = renderHook(() =>
        useNodeParenting({
          nodes,
          setNodes: mockSetNodes,
          onNodesChange: mockOnNodesChange,
          triggerGeneration: mockTriggerGeneration,
          clearHighlightOnDrag: mockClearHighlightOnDrag,
        })
      );

      act(() => {
        result.current.handleNodesChange(changes);
      });

      // setNodes should be called to unparent and remove
      expect(mockSetNodes).toHaveBeenCalled();

      // Get the update function and call it
      const updateFn = mockSetNodes.mock.calls[0][0];
      const newNodes = updateFn(nodes);

      // Child should be unparented with absolute position
      const updatedChild = newNodes.find((n: Node) => n.id === "node_1");
      expect(updatedChild?.parentId).toBeUndefined();
      expect(updatedChild?.position).toEqual({ x: 150, y: 150 }); // 100+50

      // Comment should be removed
      expect(newNodes.find((n: Node) => n.id === "comment_1")).toBeUndefined();
    });
  });

  describe("handleNodesChange - drag end parenting", () => {
    it("should call onNodesChange and setNodes for drag end", () => {
      const comment = createComment("comment_1", 0, 0, 300, 300);
      const node = createNode("node_1", 50, 50); // Inside comment bounds
      const nodes = [comment, node];

      const changes: NodeChange<Node>[] = [
        { type: "position", id: "node_1", dragging: false },
      ];

      const { result } = renderHook(() =>
        useNodeParenting({
          nodes,
          setNodes: mockSetNodes,
          onNodesChange: mockOnNodesChange,
          triggerGeneration: mockTriggerGeneration,
          clearHighlightOnDrag: mockClearHighlightOnDrag,
        })
      );

      act(() => {
        result.current.handleNodesChange(changes);
      });

      // onNodesChange should be called first
      expect(mockOnNodesChange).toHaveBeenCalledWith(changes);

      // setNodes should be called for parenting logic
      expect(mockSetNodes).toHaveBeenCalled();

      // clearHighlightOnDrag should be called
      expect(mockClearHighlightOnDrag).toHaveBeenCalledWith(changes);
    });

    it("should not process non-drag-end changes", () => {
      const node = createNode("node_1", 50, 50);
      const nodes = [node];

      const changes: NodeChange<Node>[] = [
        { type: "position", id: "node_1", dragging: true, position: { x: 60, y: 60 } },
      ];

      const { result } = renderHook(() =>
        useNodeParenting({
          nodes,
          setNodes: mockSetNodes,
          onNodesChange: mockOnNodesChange,
          triggerGeneration: mockTriggerGeneration,
          clearHighlightOnDrag: mockClearHighlightOnDrag,
        })
      );

      act(() => {
        result.current.handleNodesChange(changes);
      });

      // onNodesChange should be called
      expect(mockOnNodesChange).toHaveBeenCalledWith(changes);

      // setNodes should NOT be called for ongoing drag (not drag end)
      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it("should not auto-parent comment nodes", () => {
      const outerComment = createComment("outer", 0, 0, 500, 500);
      const innerComment = createComment("inner", 50, 50, 100, 100);
      const nodes = [outerComment, innerComment];

      const changes: NodeChange<Node>[] = [
        { type: "position", id: "inner", dragging: false },
      ];

      // Mock setNodes to return unchanged nodes (simulating no modification)
      mockSetNodes.mockImplementation((updater) => {
        const result = updater(nodes);
        // Comment nodes should not be modified
        expect(result).toEqual(nodes);
      });

      const { result } = renderHook(() =>
        useNodeParenting({
          nodes,
          setNodes: mockSetNodes,
          onNodesChange: mockOnNodesChange,
          triggerGeneration: mockTriggerGeneration,
          clearHighlightOnDrag: mockClearHighlightOnDrag,
        })
      );

      act(() => {
        result.current.handleNodesChange(changes);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });
  });

  describe("handleNodesChange - comment resize", () => {
    it("should call setNodes when comment resize ends", () => {
      const comment = createComment("comment_1", 0, 0, 300, 300);
      const node = createNode("node_1", 60, 60);
      const nodes = [comment, node];

      const changes: NodeChange<Node>[] = [
        { type: "dimensions", id: "comment_1", resizing: false },
      ];

      const { result } = renderHook(() =>
        useNodeParenting({
          nodes,
          setNodes: mockSetNodes,
          onNodesChange: mockOnNodesChange,
          triggerGeneration: mockTriggerGeneration,
          clearHighlightOnDrag: mockClearHighlightOnDrag,
        })
      );

      act(() => {
        result.current.handleNodesChange(changes);
      });

      // setNodes should be called for resize logic
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it("should not process resize for non-comment nodes", () => {
      const node = createNode("node_1", 60, 60);
      const nodes = [node];

      const changes: NodeChange<Node>[] = [
        { type: "dimensions", id: "node_1", resizing: false },
      ];

      const { result } = renderHook(() =>
        useNodeParenting({
          nodes,
          setNodes: mockSetNodes,
          onNodesChange: mockOnNodesChange,
          triggerGeneration: mockTriggerGeneration,
          clearHighlightOnDrag: mockClearHighlightOnDrag,
        })
      );

      act(() => {
        result.current.handleNodesChange(changes);
      });

      // setNodes should NOT be called (only drag-end triggers setNodes for non-resize)
      // But onNodesChange should be called
      expect(mockOnNodesChange).toHaveBeenCalledWith(changes);
    });
  });

  describe("handleNodesChange - highlight clearing", () => {
    it("should clear highlights on drag", () => {
      const node = createNode("node_1", 100, 100);
      const nodes = [node];

      const changes: NodeChange<Node>[] = [
        { type: "position", id: "node_1", dragging: true, position: { x: 110, y: 110 } },
      ];

      const { result } = renderHook(() =>
        useNodeParenting({
          nodes,
          setNodes: mockSetNodes,
          onNodesChange: mockOnNodesChange,
          triggerGeneration: mockTriggerGeneration,
          clearHighlightOnDrag: mockClearHighlightOnDrag,
        })
      );

      act(() => {
        result.current.handleNodesChange(changes);
      });

      expect(mockClearHighlightOnDrag).toHaveBeenCalledWith(changes);
    });
  });
});
