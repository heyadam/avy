import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommentAround } from "../useCommentAround";
import type { Node } from "@xyflow/react";

describe("useCommentAround", () => {
  const mockSetNodes = vi.fn();
  const mockTriggerGeneration = vi.fn();
  const mockGetId = vi.fn();
  const mockOnBeforeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetId.mockReturnValue("comment_new");
  });

  const createNode = (
    id: string,
    x: number,
    y: number,
    options: { selected?: boolean; type?: string; width?: number; height?: number } = {}
  ): Node => ({
    id,
    type: options.type ?? "text-generation",
    position: { x, y },
    selected: options.selected ?? false,
    measured: {
      width: options.width ?? 200,
      height: options.height ?? 100,
    },
    data: { label: "Node" },
  });

  const createComment = (id: string, x: number, y: number, selected = false): Node => ({
    id,
    type: "comment",
    position: { x, y },
    selected,
    style: { width: 300, height: 200 },
    data: { label: "Comment", description: "", color: "gray" },
  });

  describe("hasSelection", () => {
    it("should return false when no nodes are selected", () => {
      const nodes = [createNode("node_1", 0, 0), createNode("node_2", 100, 100)];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      expect(result.current.hasSelection).toBe(false);
    });

    it("should return true when nodes are selected", () => {
      const nodes = [
        createNode("node_1", 0, 0, { selected: true }),
        createNode("node_2", 100, 100),
      ];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      expect(result.current.hasSelection).toBe(true);
    });

    it("should return false when only comments are selected", () => {
      const nodes = [
        createNode("node_1", 0, 0),
        createComment("comment_1", 100, 100, true),
      ];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      expect(result.current.hasSelection).toBe(false);
    });
  });

  describe("handleCommentAround", () => {
    it("should do nothing when no nodes are selected", () => {
      const nodes = [createNode("node_1", 0, 0)];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
          onBeforeChange: mockOnBeforeChange,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      expect(mockOnBeforeChange).not.toHaveBeenCalled();
      expect(mockSetNodes).not.toHaveBeenCalled();
      expect(mockTriggerGeneration).not.toHaveBeenCalled();
    });

    it("should call onBeforeChange before modifying nodes", () => {
      const nodes = [createNode("node_1", 100, 100, { selected: true })];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
          onBeforeChange: mockOnBeforeChange,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      expect(mockOnBeforeChange).toHaveBeenCalledTimes(1);
      expect(mockSetNodes).toHaveBeenCalledTimes(1);
    });

    it("should call getId to generate comment ID", () => {
      const nodes = [createNode("node_1", 100, 100, { selected: true })];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      expect(mockGetId).toHaveBeenCalledTimes(1);
    });

    it("should call triggerGeneration with the new comment ID", () => {
      const nodes = [createNode("node_1", 100, 100, { selected: true })];
      mockGetId.mockReturnValue("comment_123");

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      expect(mockTriggerGeneration).toHaveBeenCalledWith("comment_123");
    });

    it("should create comment with correct bounding box for single node", () => {
      const nodes = [
        createNode("node_1", 100, 200, { selected: true, width: 200, height: 100 }),
      ];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      // Get the setNodes callback and call it with empty array to capture the result
      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback([...nodes]);

      // First node should be the comment
      const comment = newNodes[0];
      expect(comment.id).toBe("comment_new");
      expect(comment.type).toBe("comment");
      // Position: x = 100 - 40 (padding), y = 200 - 40 - 60 (padding + header)
      expect(comment.position).toEqual({ x: 60, y: 100 });
      // Size: width = 200 + 80 (2x padding), height = 100 + 80 + 60 (2x padding + header)
      expect(comment.style?.width).toBe(280);
      expect(comment.style?.height).toBe(240);
    });

    it("should create comment with correct bounding box for multiple nodes", () => {
      const nodes = [
        createNode("node_1", 0, 0, { selected: true, width: 100, height: 50 }),
        createNode("node_2", 200, 150, { selected: true, width: 100, height: 50 }),
      ];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback([...nodes]);

      const comment = newNodes[0];
      // Bounding box: minX=0, maxX=300, minY=0, maxY=200
      // Position: x = 0 - 40, y = 0 - 40 - 60
      expect(comment.position).toEqual({ x: -40, y: -100 });
      // Size: width = 300 + 80, height = 200 + 80 + 60
      expect(comment.style?.width).toBe(380);
      expect(comment.style?.height).toBe(340);
    });

    it("should parent selected nodes to the new comment", () => {
      const nodes = [
        createNode("node_1", 100, 200, { selected: true }),
        createNode("node_2", 300, 400, { selected: false }),
      ];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback([...nodes]);

      // node_1 should be parented
      const node1 = newNodes.find((n: Node) => n.id === "node_1");
      expect(node1?.parentId).toBe("comment_new");

      // node_2 should not be parented
      const node2 = newNodes.find((n: Node) => n.id === "node_2");
      expect(node2?.parentId).toBeUndefined();
    });

    it("should convert node positions to relative coordinates", () => {
      const nodes = [
        createNode("node_1", 100, 200, { selected: true, width: 200, height: 100 }),
      ];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback([...nodes]);

      // Comment position: (60, 100)
      // Original node position: (100, 200)
      // Relative position: (100 - 60, 200 - 100) = (40, 100)
      const node1 = newNodes.find((n: Node) => n.id === "node_1");
      expect(node1?.position).toEqual({ x: 40, y: 100 });
    });

    it("should exclude comment nodes from selection", () => {
      const nodes = [
        createNode("node_1", 100, 100, { selected: true }),
        createComment("existing_comment", 0, 0, true), // selected but should be ignored
      ];

      const { result } = renderHook(() =>
        useCommentAround({
          nodes,
          setNodes: mockSetNodes,
          triggerGeneration: mockTriggerGeneration,
          getId: mockGetId,
        })
      );

      act(() => {
        result.current.handleCommentAround();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback([...nodes]);

      // Only node_1 should be parented, not the existing comment
      const node1 = newNodes.find((n: Node) => n.id === "node_1");
      const existingComment = newNodes.find((n: Node) => n.id === "existing_comment");

      expect(node1?.parentId).toBe("comment_new");
      expect(existingComment?.parentId).toBeUndefined();
    });
  });
});
