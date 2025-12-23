import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, Edge, ReactFlowInstance } from "@xyflow/react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { recordToNode, recordToEdge, nodeToRecord, edgeToRecord } from "@/lib/flows/transform";
import { updateLiveFlow, type LiveFlowChanges } from "@/lib/flows/api";
import type { FlowNodeRecord, FlowEdgeRecord, LiveFlowData } from "@/lib/flows/types";

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;
type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;

// Broadcast message types for realtime sync
type BroadcastMessage =
  | { type: "nodes_updated"; nodes: NodePayload[]; senderId: string }
  | { type: "edges_updated"; edges: EdgePayload[]; senderId: string }
  | { type: "nodes_deleted"; nodeIds: string[]; senderId: string }
  | { type: "edges_deleted"; edgeIds: string[]; senderId: string }
  | { type: "cursor_moved"; userId: string; position: { x: number; y: number } }
  | { type: "user_joined"; userId: string; name?: string }
  | { type: "user_left"; userId: string };

interface NodePayload {
  id: string;
  type: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: Record<string, unknown>;
  parentId?: string;
}

interface EdgePayload {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface Collaborator {
  userId: string;
  name?: string;
  cursor?: { x: number; y: number };
  lastSeen: number;
}

// Generate a unique session ID for this client
const generateSessionId = () => `user_${Math.random().toString(36).substring(2, 11)}`;

export interface CollaborationModeProps {
  shareToken: string;
  liveId: string;
  initialFlow: {
    flow: LiveFlowData["flow"];
    nodes: FlowNodeRecord[];
    edges: FlowEdgeRecord[];
  } | null;
}

export interface UseCollaborationOptions {
  collaborationMode?: CollaborationModeProps;
  nodes: Node[];
  edges: Edge[];
  setNodes: SetNodes;
  setEdges: SetEdges;
  reactFlowInstance: React.MutableRefObject<ReactFlowInstance | null>;
  setIdCounter: (id: number) => void;
}

export interface UseCollaborationReturn {
  isCollaborating: boolean;
  shareToken: string | null;
  liveId: string | null;
  flowName: string | null;
  isSaving: boolean;
  lastSaveError: string | null;
  // Triggers a save (debounced internally)
  triggerSave: () => void;
  // Force immediate save
  saveNow: () => Promise<void>;
  // Realtime sync status
  isRealtimeConnected: boolean;
  collaborators: Collaborator[];
  // Broadcast cursor position for presence
  broadcastCursor: (position: { x: number; y: number }) => void;
}

// Update ID counter based on existing nodes
const updateIdCounter = (nodes: Node[], setIdCounter: (id: number) => void) => {
  const maxId = nodes.reduce((max, node) => {
    const match = node.id.match(/node_(\d+)/);
    if (match) {
      return Math.max(max, parseInt(match[1], 10));
    }
    return max;
  }, -1);
  setIdCounter(maxId + 1);
};

// Initialize Supabase client for realtime
const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

/**
 * Hook for collaboration mode - handles live flow initialization, debounced saving, and realtime sync
 */
export function useCollaboration({
  collaborationMode,
  nodes,
  edges,
  setNodes,
  setEdges,
  reactFlowInstance,
  setIdCounter,
}: UseCollaborationOptions): UseCollaborationReturn {
  const isCollaborating = !!collaborationMode;
  const shareToken = collaborationMode?.shareToken ?? null;
  const liveId = collaborationMode?.liveId ?? null;

  const [flowName, setFlowName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Realtime sync state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const sessionIdRef = useRef<string>(generateSessionId());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isApplyingRemoteRef = useRef(false); // Flag to prevent re-broadcasting received changes

  // Track previous state for diffing
  const prevNodesRef = useRef<Node[]>([]);
  const prevEdgesRef = useRef<Edge[]>([]);

  // Debounce timer
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize flow from collaboration data
  useEffect(() => {
    if (!collaborationMode?.initialFlow || initialized) return;

    const { flow, nodes: nodeRecords, edges: edgeRecords } = collaborationMode.initialFlow;

    // Convert DB records to React Flow format
    const convertedNodes = nodeRecords.map(recordToNode);
    const convertedEdges = edgeRecords.map(recordToEdge);

    setNodes(convertedNodes);
    setEdges(convertedEdges);
    setFlowName(flow?.name || "Untitled Flow");

    // Update refs to track initial state
    prevNodesRef.current = convertedNodes;
    prevEdgesRef.current = convertedEdges;

    // Update ID counter to avoid collisions
    updateIdCounter(convertedNodes, setIdCounter);

    setInitialized(true);

    // Fit view after a short delay
    setTimeout(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2 });
    }, 100);
  }, [collaborationMode, initialized, setNodes, setEdges, setIdCounter, reactFlowInstance]);

  // Save changes to live flow
  const performSave = useCallback(async () => {
    if (!shareToken || !isCollaborating) return;

    // Calculate diff
    const prevNodeIds = new Set(prevNodesRef.current.map((n) => n.id));
    const prevEdgeIds = new Set(prevEdgesRef.current.map((e) => e.id));
    const currentNodeIds = new Set(nodes.map((n) => n.id));
    const currentEdgeIds = new Set(edges.map((e) => e.id));

    // Find deleted nodes and edges
    const deletedNodeIds = [...prevNodeIds].filter((id) => !currentNodeIds.has(id));
    const deletedEdgeIds = [...prevEdgeIds].filter((id) => !currentEdgeIds.has(id));

    // Find added or modified nodes (we send all current nodes for simplicity)
    // In a more optimized version, we'd track which nodes actually changed
    const nodeRecords = nodes
      .filter((n) => n.type !== "comment" || n.data) // Include all valid nodes
      .map((n) => nodeToRecord(n, ""));

    const edgeRecords = edges.map((e) => edgeToRecord(e, ""));

    // Build changes object
    const changes: LiveFlowChanges = {};

    if (nodeRecords.length > 0) {
      changes.nodes = nodeRecords;
    }
    if (edgeRecords.length > 0) {
      changes.edges = edgeRecords;
    }
    if (deletedNodeIds.length > 0) {
      changes.deletedNodeIds = deletedNodeIds;
    }
    if (deletedEdgeIds.length > 0) {
      changes.deletedEdgeIds = deletedEdgeIds;
    }

    // Skip save if no changes
    if (
      !changes.nodes &&
      !changes.edges &&
      !changes.deletedNodeIds &&
      !changes.deletedEdgeIds
    ) {
      return;
    }

    setIsSaving(true);
    setLastSaveError(null);

    try {
      const result = await updateLiveFlow(shareToken, changes);
      if (!result.success) {
        setLastSaveError(result.error || "Failed to save");
        console.error("Failed to save live flow:", result.error);
      } else {
        // Update refs to current state after successful save
        prevNodesRef.current = [...nodes];
        prevEdgesRef.current = [...edges];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      setLastSaveError(message);
      console.error("Error saving live flow:", error);
    } finally {
      setIsSaving(false);
    }
  }, [shareToken, isCollaborating, nodes, edges]);

  // Trigger a debounced save
  const triggerSave = useCallback(() => {
    if (!isCollaborating) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout (500ms debounce)
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
      saveTimeoutRef.current = null;
    }, 500);
  }, [isCollaborating, performSave]);

  // Force immediate save
  const saveNow = useCallback(async () => {
    if (!isCollaborating) return;

    // Clear pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    await performSave();
  }, [isCollaborating, performSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save on changes when collaborating
  useEffect(() => {
    if (!isCollaborating || !initialized) return;

    // Trigger save when nodes or edges change
    triggerSave();
  }, [nodes, edges, isCollaborating, initialized, triggerSave]);

  // Convert React Flow Node to broadcast payload
  const nodeToPayload = useCallback((node: Node): NodePayload => ({
    id: node.id,
    type: node.type || "default",
    position: node.position,
    width: node.measured?.width ?? (node.width as number | undefined),
    height: node.measured?.height ?? (node.height as number | undefined),
    data: node.data as Record<string, unknown>,
    parentId: node.parentId,
  }), []);

  // Convert React Flow Edge to broadcast payload
  const edgeToPayload = useCallback((edge: Edge): EdgePayload => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? undefined,
    target: edge.target,
    targetHandle: edge.targetHandle ?? undefined,
    type: edge.type,
    data: edge.data as Record<string, unknown> | undefined,
  }), []);

  // Apply incoming node updates from remote collaborators
  const applyRemoteNodeUpdates = useCallback((payloads: NodePayload[], senderId: string) => {
    if (senderId === sessionIdRef.current) return;

    isApplyingRemoteRef.current = true;
    setNodes((currentNodes) => {
      const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));

      for (const payload of payloads) {
        const existing = nodeMap.get(payload.id);
        if (existing) {
          nodeMap.set(payload.id, {
            ...existing,
            position: payload.position,
            width: payload.width,
            height: payload.height,
            data: payload.data,
            parentId: payload.parentId,
          });
        } else {
          nodeMap.set(payload.id, {
            id: payload.id,
            type: payload.type,
            position: payload.position,
            width: payload.width,
            height: payload.height,
            data: payload.data,
            parentId: payload.parentId,
          });
        }
      }

      const result = Array.from(nodeMap.values());
      prevNodesRef.current = result; // Update prev ref to avoid re-broadcasting
      return result;
    });
    setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
  }, [setNodes]);

  // Apply incoming edge updates from remote collaborators
  const applyRemoteEdgeUpdates = useCallback((payloads: EdgePayload[], senderId: string) => {
    if (senderId === sessionIdRef.current) return;

    isApplyingRemoteRef.current = true;
    setEdges((currentEdges) => {
      const edgeMap = new Map(currentEdges.map((e) => [e.id, e]));

      for (const payload of payloads) {
        const existing = edgeMap.get(payload.id);
        if (existing) {
          edgeMap.set(payload.id, {
            ...existing,
            source: payload.source,
            sourceHandle: payload.sourceHandle,
            target: payload.target,
            targetHandle: payload.targetHandle,
            type: payload.type,
            data: payload.data,
          });
        } else {
          edgeMap.set(payload.id, {
            id: payload.id,
            source: payload.source,
            sourceHandle: payload.sourceHandle ?? null,
            target: payload.target,
            targetHandle: payload.targetHandle ?? null,
            type: payload.type || "colored",
            data: payload.data,
          });
        }
      }

      const result = Array.from(edgeMap.values());
      prevEdgesRef.current = result;
      return result;
    });
    setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
  }, [setEdges]);

  // Apply node deletions from remote collaborators
  const applyRemoteNodeDeletions = useCallback((nodeIds: string[], senderId: string) => {
    if (senderId === sessionIdRef.current) return;

    isApplyingRemoteRef.current = true;
    setNodes((currentNodes) => {
      const result = currentNodes.filter((n) => !nodeIds.includes(n.id));
      prevNodesRef.current = result;
      return result;
    });
    setEdges((currentEdges) => {
      const result = currentEdges.filter(
        (e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
      );
      prevEdgesRef.current = result;
      return result;
    });
    setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
  }, [setNodes, setEdges]);

  // Apply edge deletions from remote collaborators
  const applyRemoteEdgeDeletions = useCallback((edgeIds: string[], senderId: string) => {
    if (senderId === sessionIdRef.current) return;

    isApplyingRemoteRef.current = true;
    setEdges((currentEdges) => {
      const result = currentEdges.filter((e) => !edgeIds.includes(e.id));
      prevEdgesRef.current = result;
      return result;
    });
    setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
  }, [setEdges]);

  // Handle collaborator cursor update
  const handleRemoteCursor = useCallback((userId: string, position: { x: number; y: number }) => {
    if (userId === sessionIdRef.current) return;

    setCollaborators((current) => {
      const existing = current.find((c) => c.userId === userId);
      if (existing) {
        return current.map((c) =>
          c.userId === userId ? { ...c, cursor: position, lastSeen: Date.now() } : c
        );
      }
      return [...current, { userId, cursor: position, lastSeen: Date.now() }];
    });
  }, []);

  // Handle user joined
  const handleUserJoined = useCallback((userId: string, name?: string) => {
    if (userId === sessionIdRef.current) return;

    setCollaborators((current) => {
      if (current.find((c) => c.userId === userId)) {
        return current.map((c) =>
          c.userId === userId ? { ...c, name, lastSeen: Date.now() } : c
        );
      }
      return [...current, { userId, name, lastSeen: Date.now() }];
    });
  }, []);

  // Handle user left
  const handleUserLeft = useCallback((userId: string) => {
    setCollaborators((current) => current.filter((c) => c.userId !== userId));
  }, []);

  // Set up realtime channel
  useEffect(() => {
    if (!shareToken || !isCollaborating || !initialized) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn("Supabase client not available for realtime sync");
      return;
    }

    const channelName = `flow:${shareToken}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    // Listen for all broadcast events
    channel.on("broadcast", { event: "*" }, (payload) => {
      const message = payload.payload as BroadcastMessage;

      switch (message.type) {
        case "nodes_updated":
          applyRemoteNodeUpdates(message.nodes, message.senderId);
          break;
        case "edges_updated":
          applyRemoteEdgeUpdates(message.edges, message.senderId);
          break;
        case "nodes_deleted":
          applyRemoteNodeDeletions(message.nodeIds, message.senderId);
          break;
        case "edges_deleted":
          applyRemoteEdgeDeletions(message.edgeIds, message.senderId);
          break;
        case "cursor_moved":
          handleRemoteCursor(message.userId, message.position);
          break;
        case "user_joined":
          handleUserJoined(message.userId, message.name);
          break;
        case "user_left":
          handleUserLeft(message.userId);
          break;
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsRealtimeConnected(true);
        // Announce presence
        channel.send({
          type: "broadcast",
          event: "presence",
          payload: { type: "user_joined", userId: sessionIdRef.current } as BroadcastMessage,
        });
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        setIsRealtimeConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      // Announce we're leaving
      channel.send({
        type: "broadcast",
        event: "presence",
        payload: { type: "user_left", userId: sessionIdRef.current } as BroadcastMessage,
      });
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsRealtimeConnected(false);
      setCollaborators([]);
    };
  }, [
    shareToken,
    isCollaborating,
    initialized,
    applyRemoteNodeUpdates,
    applyRemoteEdgeUpdates,
    applyRemoteNodeDeletions,
    applyRemoteEdgeDeletions,
    handleRemoteCursor,
    handleUserJoined,
    handleUserLeft,
  ]);

  // Broadcast local changes to other collaborators
  useEffect(() => {
    if (!isCollaborating || !initialized || !isRealtimeConnected || isApplyingRemoteRef.current) return;
    if (!channelRef.current) return;

    // Calculate what changed
    const prevNodeIds = new Set(prevNodesRef.current.map((n) => n.id));
    const prevEdgeIds = new Set(prevEdgesRef.current.map((e) => e.id));
    const currentNodeIds = new Set(nodes.map((n) => n.id));
    const currentEdgeIds = new Set(edges.map((e) => e.id));

    const deletedNodeIds = [...prevNodeIds].filter((id) => !currentNodeIds.has(id));
    const deletedEdgeIds = [...prevEdgeIds].filter((id) => !currentEdgeIds.has(id));

    // Broadcast deletions
    if (deletedNodeIds.length > 0) {
      channelRef.current.send({
        type: "broadcast",
        event: "sync",
        payload: {
          type: "nodes_deleted",
          nodeIds: deletedNodeIds,
          senderId: sessionIdRef.current,
        } as BroadcastMessage,
      });
    }

    if (deletedEdgeIds.length > 0) {
      channelRef.current.send({
        type: "broadcast",
        event: "sync",
        payload: {
          type: "edges_deleted",
          edgeIds: deletedEdgeIds,
          senderId: sessionIdRef.current,
        } as BroadcastMessage,
      });
    }

    // Broadcast node updates (all nodes for simplicity)
    if (nodes.length > 0) {
      channelRef.current.send({
        type: "broadcast",
        event: "sync",
        payload: {
          type: "nodes_updated",
          nodes: nodes.map(nodeToPayload),
          senderId: sessionIdRef.current,
        } as BroadcastMessage,
      });
    }

    // Broadcast edge updates
    if (edges.length > 0) {
      channelRef.current.send({
        type: "broadcast",
        event: "sync",
        payload: {
          type: "edges_updated",
          edges: edges.map(edgeToPayload),
          senderId: sessionIdRef.current,
        } as BroadcastMessage,
      });
    }
  }, [nodes, edges, isCollaborating, initialized, isRealtimeConnected, nodeToPayload, edgeToPayload]);

  // Clean up stale collaborators
  useEffect(() => {
    if (!isCollaborating) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setCollaborators((current) => current.filter((c) => now - c.lastSeen < 30000));
    }, 10000);

    return () => clearInterval(interval);
  }, [isCollaborating]);

  // Broadcast cursor position
  const broadcastCursor = useCallback((position: { x: number; y: number }) => {
    if (!channelRef.current || !isRealtimeConnected) return;

    channelRef.current.send({
      type: "broadcast",
      event: "cursor",
      payload: {
        type: "cursor_moved",
        userId: sessionIdRef.current,
        position,
      } as BroadcastMessage,
    });
  }, [isRealtimeConnected]);

  return {
    isCollaborating,
    shareToken,
    liveId,
    flowName,
    isSaving,
    lastSaveError,
    triggerSave,
    saveNow,
    isRealtimeConnected,
    collaborators,
    broadcastCursor,
  };
}
