"use client";

import { useState } from "react";
import { useReactFlow, useEdges, type NodeProps, type Node, type Edge } from "@xyflow/react";
import type { RealtimeNodeData, AudioEdgeData } from "@/types/flow";
import { Mic, Square, Loader2 } from "lucide-react";
import { NodeFrame } from "./NodeFrame";
import { PortRow } from "./PortLabel";
import { InputWithHandle } from "./InputWithHandle";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRealtimeSession } from "@/lib/hooks/useRealtimeSession";

const VOICES = ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"] as const;

type RealtimeNodeType = Node<RealtimeNodeData, "realtime-conversation">;

// Helper to get audio stream ID from connected edge
function getConnectedAudioStreamId(edges: Edge[], nodeId: string): string | undefined {
  const audioEdge = edges.find(
    (edge) => edge.target === nodeId && edge.targetHandle === "audio-in"
  );
  if (!audioEdge) return undefined;
  // The streamId is stored in edge.data by the source audio node
  return (audioEdge.data as AudioEdgeData | undefined)?.streamId;
}

export function RealtimeNode({ id, data }: NodeProps<RealtimeNodeType>) {
  const { updateNodeData } = useReactFlow();
  const edges = useEdges();
  const [isPttHeld, setIsPttHeld] = useState(false);

  // Check connection states
  const isInstructionsConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === "instructions"
  );
  const isAudioInConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === "audio-in"
  );
  const isTranscriptConnected = edges.some(
    (edge) => edge.source === id && edge.sourceHandle === "transcript"
  );
  const isAudioOutConnected = edges.some(
    (edge) => edge.source === id && edge.sourceHandle === "audio-out"
  );

  // Realtime session hook
  const {
    status,
    transcript,
    elapsedSeconds,
    errorMessage,
    connect,
    disconnect,
    sendEvent,
  } = useRealtimeSession({
    nodeId: id,
    audioInStreamId: isAudioInConnected ? getConnectedAudioStreamId(edges, id) : undefined,
    onTranscriptUpdate: (entries) => updateNodeData(id, { transcript: entries }),
    onStatusChange: (newStatus) => updateNodeData(id, { sessionStatus: newStatus }),
    onAudioOutStream: (streamId) => updateNodeData(id, { audioOutStreamId: streamId }),
  });

  // Handler to start session with current config
  const handleStartSession = () => {
    connect({
      instructions: data.instructions,
      voice: data.voice,
      vadMode: data.vadMode,
    });
  };

  return (
    <NodeFrame
      title={data.label}
      onTitleChange={(label) => updateNodeData(id, { label })}
      icon={<Mic className="h-4 w-4" />}
      iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
      accentBorderClassName="border-emerald-500"
      status={data.executionStatus}
      className="w-[360px]"
      ports={
        <>
          <PortRow
            nodeId={id}
            input={{ id: "instructions", label: "Instructions", colorClass: "cyan", isConnected: isInstructionsConnected }}
            output={{ id: "transcript", label: "Transcript", colorClass: "cyan", isConnected: isTranscriptConnected }}
          />
          <PortRow
            nodeId={id}
            input={{ id: "audio-in", label: "Audio In", colorClass: "emerald", isConnected: isAudioInConnected }}
            output={{ id: "audio-out", label: "Audio Out", colorClass: "emerald", isConnected: isAudioOutConnected }}
          />
        </>
      }
      footer={
        (data.executionError || errorMessage) ? (
          <p className="text-xs text-destructive whitespace-pre-wrap line-clamp-4">
            {data.executionError || errorMessage}
          </p>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* Instructions input (can be connected or inline) */}
        <InputWithHandle
          id="instructions"
          label="System Instructions"
          colorClass="cyan"
          isConnected={isInstructionsConnected}
        >
          <textarea
            value={isInstructionsConnected ? "" : (data.instructions ?? "")}
            onChange={(e) => updateNodeData(id, { instructions: e.target.value })}
            placeholder={isInstructionsConnected ? "Connected" : "You are a helpful assistant..."}
            disabled={isInstructionsConnected}
            className={cn(
              "nodrag w-full min-h-[60px] resize-y rounded-md border border-input px-3 py-2 text-sm",
              "shadow-xs transition-[color,box-shadow] outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              isInstructionsConnected
                ? "bg-muted/50 dark:bg-muted/20 cursor-not-allowed"
                : "bg-background/60 dark:bg-muted/40"
            )}
          />
        </InputWithHandle>

        {/* Voice and VAD mode selectors */}
        <div className="flex gap-2">
          <Select
            value={data.voice}
            onValueChange={(v) => updateNodeData(id, { voice: v })}
          >
            <SelectTrigger className="flex-1 nodrag">
              <SelectValue placeholder="Voice" />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={data.vadMode}
            onValueChange={(v) => updateNodeData(id, { vadMode: v })}
          >
            <SelectTrigger className="flex-1 nodrag">
              <SelectValue placeholder="VAD" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semantic_vad">Semantic VAD</SelectItem>
              <SelectItem value="server_vad">Server VAD</SelectItem>
              <SelectItem value="disabled">Manual (PTT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Session controls */}
        <div className="flex items-center gap-2">
          {status === "disconnected" ? (
            <Button onClick={handleStartSession} className="flex-1 nodrag">
              <Mic className="w-4 h-4 mr-2" />
              Start Session
            </Button>
          ) : status === "connecting" ? (
            <Button disabled className="flex-1 nodrag">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </Button>
          ) : (
            <Button variant="destructive" onClick={disconnect} className="flex-1 nodrag">
              <Square className="w-4 h-4 mr-2" />
              End Session
            </Button>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === "connected" && "bg-green-500 animate-pulse",
              status === "connecting" && "bg-yellow-500 animate-pulse",
              status === "error" && "bg-red-500",
              status === "disconnected" && "bg-gray-500"
            )} />
            {status === "connected" && (
              <span className="text-xs text-muted-foreground">
                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
              </span>
            )}
          </div>
        </div>

        {/* Push-to-Talk button (when VAD is disabled) */}
        {status === "connected" && data.vadMode === "disabled" && (
          <Button
            variant="outline"
            className="w-full nodrag"
            onMouseDown={() => {
              setIsPttHeld(true);
              sendEvent({ type: "input_audio_buffer.clear" });
            }}
            onMouseUp={() => {
              if (isPttHeld) {
                setIsPttHeld(false);
                sendEvent({ type: "input_audio_buffer.commit" });
                sendEvent({ type: "response.create" });
              }
            }}
            onMouseLeave={() => {
              // Only commit if mouse leaves while button is held down
              if (isPttHeld) {
                setIsPttHeld(false);
                sendEvent({ type: "input_audio_buffer.commit" });
                sendEvent({ type: "response.create" });
              }
            }}
          >
            <Mic className="w-4 h-4 mr-2" />
            Hold to Talk
          </Button>
        )}

        {/* Transcript display */}
        {transcript && transcript.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-md">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "text-sm p-2 rounded",
                  entry.role === "user" ? "bg-blue-500/10" : "bg-emerald-500/10"
                )}
              >
                <span className="font-medium">
                  {entry.role === "user" ? "You" : "AI"}:
                </span>{" "}
                {entry.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeFrame>
  );
}
