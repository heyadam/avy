import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptKeys, decryptKeys, type StoredApiKeys } from "@/lib/encryption";

/**
 * GET /api/user/keys - Get stored key status (not the keys themselves)
 *
 * Returns which providers have keys stored, not the actual keys.
 */
export async function GET() {
  try {
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

    // Fetch the user's stored keys
    const { data, error } = await supabase
      .from("user_api_keys")
      .select("keys_encrypted")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (user has no stored keys)
      console.error("Error fetching user keys:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch keys" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        hasOpenai: false,
        hasGoogle: false,
        hasAnthropic: false,
      });
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error("ENCRYPTION_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    try {
      const keys = decryptKeys(data.keys_encrypted, encryptionKey);
      return NextResponse.json({
        success: true,
        hasOpenai: !!keys.openai,
        hasGoogle: !!keys.google,
        hasAnthropic: !!keys.anthropic,
      });
    } catch {
      console.error("Error decrypting keys");
      return NextResponse.json(
        { success: false, error: "Failed to decrypt keys" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in GET /api/user/keys:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/keys - Store encrypted API keys server-side
 *
 * Keys are encrypted with AES-256-GCM before storage.
 */
export async function PUT(request: NextRequest) {
  try {
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

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error("ENCRYPTION_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { openai, google, anthropic } = body as StoredApiKeys;

    // Validate at least one key is provided
    if (!openai && !google && !anthropic) {
      return NextResponse.json(
        { success: false, error: "At least one API key must be provided" },
        { status: 400 }
      );
    }

    // Encrypt the keys
    const keysToStore: StoredApiKeys = {};
    if (openai) keysToStore.openai = openai;
    if (google) keysToStore.google = google;
    if (anthropic) keysToStore.anthropic = anthropic;

    const encrypted = encryptKeys(keysToStore, encryptionKey);

    // Upsert the keys
    const { error: upsertError } = await supabase
      .from("user_api_keys")
      .upsert({
        user_id: user.id,
        keys_encrypted: encrypted,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error("Error storing keys:", upsertError);
      return NextResponse.json(
        { success: false, error: "Failed to store keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      hasOpenai: !!openai,
      hasGoogle: !!google,
      hasAnthropic: !!anthropic,
    });
  } catch (error) {
    console.error("Error in PUT /api/user/keys:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/keys - Remove stored API keys
 */
export async function DELETE() {
  try {
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

    // Delete the user's stored keys
    const { error: deleteError } = await supabase
      .from("user_api_keys")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting keys:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/user/keys:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
