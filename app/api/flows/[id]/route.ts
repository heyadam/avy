import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SavedFlow } from "@/lib/flow-storage/types";
import type { FlowRecord, FlowNodeRecord, FlowEdgeRecord } from "@/lib/flows/types";
import { recordsToNodes, recordsToEdges } from "@/lib/flows/transform";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/flows/[id] - Get a flow by ID
 *
 * Loads from DB tables (flow_nodes, flow_edges) first.
 * Falls back to Storage for flows not yet migrated.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get the current user
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

    // Fetch the flow record
    const { data: flowRecord, error: fetchError } = await supabase
      .from("flows")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !flowRecord) {
      return NextResponse.json(
        { success: false, error: "Flow not found" },
        { status: 404 }
      );
    }

    // Try to load from DB tables first
    const { data: nodeRecords } = await supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", id);

    const { data: edgeRecords } = await supabase
      .from("flow_edges")
      .select("*")
      .eq("flow_id", id);

    // If we have nodes in DB, use DB data
    if (nodeRecords && nodeRecords.length > 0) {
      const nodes = recordsToNodes(nodeRecords as FlowNodeRecord[]);
      const edges = recordsToEdges((edgeRecords || []) as FlowEdgeRecord[]);

      const flow: SavedFlow = {
        metadata: {
          name: flowRecord.name,
          description: flowRecord.description || undefined,
          createdAt: flowRecord.created_at,
          updatedAt: flowRecord.updated_at,
          schemaVersion: 1,
        },
        nodes,
        edges,
      };

      return NextResponse.json({
        success: true,
        flow,
        metadata: flowRecord as FlowRecord,
      });
    }

    // Fall back to Storage for non-migrated flows
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("flows")
      .download(flowRecord.storage_path);

    if (downloadError || !fileData) {
      console.error("Error downloading flow content:", downloadError);
      return NextResponse.json(
        { success: false, error: "Failed to download flow content" },
        { status: 500 }
      );
    }

    // Parse the flow JSON
    const flowText = await fileData.text();
    const flow = JSON.parse(flowText) as SavedFlow;

    return NextResponse.json({
      success: true,
      flow,
      metadata: flowRecord as FlowRecord,
    });
  } catch (error) {
    console.error("Error in GET /api/flows/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/flows/[id] - Update an existing flow
 *
 * Saves to both Storage (backup) and DB tables (primary).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get the current user
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

    // Parse the request body
    const body = await request.json();
    const flow = body.flow as SavedFlow;

    if (!flow || !flow.metadata?.name) {
      return NextResponse.json(
        { success: false, error: "Invalid flow data" },
        { status: 400 }
      );
    }

    // Fetch the existing flow record to verify ownership
    const { data: existingFlow, error: fetchError } = await supabase
      .from("flows")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingFlow) {
      return NextResponse.json(
        { success: false, error: "Flow not found" },
        { status: 404 }
      );
    }

    // Update the flow content in storage (backup)
    const flowJson = JSON.stringify(flow);
    const { error: uploadError } = await supabase.storage
      .from("flows")
      .update(existingFlow.storage_path, flowJson, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error updating flow in storage:", uploadError);
      // Continue anyway - DB is the primary storage now
    }

    // Update nodes in DB - delete existing and insert new
    const { error: deleteNodesError } = await supabase
      .from("flow_nodes")
      .delete()
      .eq("flow_id", id);

    if (deleteNodesError) {
      console.error("Error deleting existing nodes:", deleteNodesError);
    }

    const { error: deleteEdgesError } = await supabase
      .from("flow_edges")
      .delete()
      .eq("flow_id", id);

    if (deleteEdgesError) {
      console.error("Error deleting existing edges:", deleteEdgesError);
    }

    // Import transform functions dynamically to avoid circular deps
    const { nodesToRecords, edgesToRecords } = await import("@/lib/flows/transform");

    // Insert nodes
    if (flow.nodes.length > 0) {
      const nodeRecords = nodesToRecords(flow.nodes, id);
      const { error: insertNodesError } = await supabase
        .from("flow_nodes")
        .insert(nodeRecords);

      if (insertNodesError) {
        console.error("Error inserting nodes:", insertNodesError);
        return NextResponse.json(
          { success: false, error: "Failed to save nodes" },
          { status: 500 }
        );
      }
    }

    // Insert edges
    if (flow.edges.length > 0) {
      const edgeRecords = edgesToRecords(flow.edges, id);
      const { error: insertEdgesError } = await supabase
        .from("flow_edges")
        .insert(edgeRecords);

      if (insertEdgesError) {
        console.error("Error inserting edges:", insertEdgesError);
        return NextResponse.json(
          { success: false, error: "Failed to save edges" },
          { status: 500 }
        );
      }
    }

    // Update the flows table metadata
    const { data: updatedFlow, error: updateError } = await supabase
      .from("flows")
      .update({
        name: flow.metadata.name,
        description: flow.metadata.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating flow record:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update flow record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      flow: updatedFlow as FlowRecord,
    });
  } catch (error) {
    console.error("Error in PUT /api/flows/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flows/[id] - Delete a flow
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get the current user
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

    // Fetch the flow record to get storage path
    const { data: flowRecord, error: fetchError } = await supabase
      .from("flows")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !flowRecord) {
      return NextResponse.json(
        { success: false, error: "Flow not found" },
        { status: 404 }
      );
    }

    // Delete from storage
    const { error: deleteStorageError } = await supabase.storage
      .from("flows")
      .remove([flowRecord.storage_path]);

    if (deleteStorageError) {
      console.error("Error deleting flow from storage:", deleteStorageError);
      // Continue to delete the database record even if storage deletion fails
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from("flows")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting flow record:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete flow record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/flows/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
