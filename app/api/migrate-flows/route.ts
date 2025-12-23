import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SavedFlow } from "@/lib/flow-storage/types";
import type { Node, Edge } from "@xyflow/react";

/**
 * POST /api/migrate-flows - One-time migration of flows from Storage to DB tables
 *
 * Reads existing flow JSON files from Supabase Storage and populates
 * flow_nodes and flow_edges tables.
 *
 * This is a one-time migration endpoint - can be removed after migration is complete.
 */

// Fields that go into private_data (content that could be sensitive)
const PRIVATE_DATA_FIELDS = [
  "userPrompt",
  "systemPrompt",
  "inputValue",
  "prompt",
  "transformPrompt",
  "generatedCode",
  "codeExplanation",
  "provider",
  "model",
  "verbosity",
  "thinking",
  "googleThinkingConfig",
  "googleSafetySettings",
  "googleSafetyPreset",
  "googleStructuredOutputs",
  "outputFormat",
  "size",
  "quality",
  "partialImages",
  "aspectRatio",
  "stylePreset",
];

// Fields that go into data (UI state)
const UI_DATA_FIELDS = [
  "label",
  "selected",
  "dragging",
  "color",
  "description",
  "isGenerating",
  "userEdited",
  "codeExpanded",
  "evalExpanded",
  "evalResults",
];

function splitNodeData(nodeData: Record<string, unknown>): {
  data: Record<string, unknown>;
  privateData: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {};
  const privateData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(nodeData)) {
    // Skip execution state (not persisted)
    if (key.startsWith("execution")) continue;

    if (PRIVATE_DATA_FIELDS.includes(key)) {
      privateData[key] = value;
    } else if (UI_DATA_FIELDS.includes(key)) {
      data[key] = value;
    } else {
      // Unknown fields go to data by default
      data[key] = value;
    }
  }

  return { data, privateData };
}

function transformNode(node: Node, flowId: string) {
  const { data, privateData } = splitNodeData(node.data as Record<string, unknown>);

  return {
    id: node.id,
    flow_id: flowId,
    type: node.type || "unknown",
    position_x: node.position.x,
    position_y: node.position.y,
    width: node.width ?? node.measured?.width ?? null,
    height: node.height ?? node.measured?.height ?? null,
    data,
    private_data: privateData,
    parent_id: node.parentId ?? null,
  };
}

function transformEdge(edge: Edge, flowId: string) {
  return {
    id: edge.id,
    flow_id: flowId,
    source_node_id: edge.source,
    source_handle: edge.sourceHandle ?? null,
    target_node_id: edge.target,
    target_handle: edge.targetHandle ?? null,
    edge_type: edge.type || "colored",
    data: edge.data ?? {},
  };
}

export async function POST() {
  try {
    const supabase = await createClient();

    // Get the current user (require auth for safety)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch all flows for this user
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("id, name, storage_path")
      .eq("user_id", user.id);

    if (flowsError) {
      console.error("Error fetching flows:", flowsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch flows" },
        { status: 500 }
      );
    }

    const results: Array<{
      flowId: string;
      name: string;
      success: boolean;
      nodesInserted?: number;
      edgesInserted?: number;
      error?: string;
    }> = [];

    for (const flow of flows || []) {
      try {
        // Check if flow already has nodes (already migrated)
        const { count: existingNodes } = await supabase
          .from("flow_nodes")
          .select("*", { count: "exact", head: true })
          .eq("flow_id", flow.id);

        if (existingNodes && existingNodes > 0) {
          results.push({
            flowId: flow.id,
            name: flow.name,
            success: true,
            nodesInserted: 0,
            edgesInserted: 0,
            error: "Already migrated (skipped)",
          });
          continue;
        }

        // Download flow JSON from Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("flows")
          .download(flow.storage_path);

        if (downloadError) {
          results.push({
            flowId: flow.id,
            name: flow.name,
            success: false,
            error: `Download failed: ${downloadError.message}`,
          });
          continue;
        }

        // Parse JSON
        const text = await fileData.text();
        const savedFlow: SavedFlow = JSON.parse(text);

        // Transform and insert nodes
        const nodesToInsert = savedFlow.nodes.map((node) =>
          transformNode(node, flow.id)
        );

        if (nodesToInsert.length > 0) {
          const { error: nodesError } = await supabase
            .from("flow_nodes")
            .insert(nodesToInsert);

          if (nodesError) {
            results.push({
              flowId: flow.id,
              name: flow.name,
              success: false,
              error: `Nodes insert failed: ${nodesError.message}`,
            });
            continue;
          }
        }

        // Transform and insert edges
        const edgesToInsert = savedFlow.edges.map((edge) =>
          transformEdge(edge, flow.id)
        );

        if (edgesToInsert.length > 0) {
          const { error: edgesError } = await supabase
            .from("flow_edges")
            .insert(edgesToInsert);

          if (edgesError) {
            results.push({
              flowId: flow.id,
              name: flow.name,
              success: false,
              error: `Edges insert failed: ${edgesError.message}`,
            });
            continue;
          }
        }

        results.push({
          flowId: flow.id,
          name: flow.name,
          success: true,
          nodesInserted: nodesToInsert.length,
          edgesInserted: edgesToInsert.length,
        });
      } catch (err) {
        results.push({
          flowId: flow.id,
          name: flow.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      migratedCount: results.filter((r) => r.success && r.nodesInserted).length,
      skippedCount: results.filter((r) => r.error?.includes("skipped")).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Error in POST /api/migrate-flows:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
