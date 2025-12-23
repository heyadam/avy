# Live Workflow IDs with Realtime & MCP Support

## Overview

Add unique 4-digit live workflow IDs that enable:
1. **Public sharing** via URLs like `composer.design/1234`
2. **Realtime collaboration** (Figma-style) via Supabase Realtime
3. **MCP integration** for reading flow structure and executing workflows

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ID format | 4-digit vanity + 12-char secret token | Vanity for display, token for security |
| Access | Requires share token for access | Prevents enumeration attacks |
| Storage | Normalized DB tables | Enables Supabase Realtime subscriptions |
| Data separation | Separate `data`/`private_data` columns | Future-proofs for read-only mode (not used yet) |
| API keys | Dual-source, NEVER in flow data | Signed-out: localStorage. Signed-in: optional server-side encrypted storage |
| Execution | Owner-controlled toggle + quotas | Prevents deny-of-wallet attacks |

## Security Model

### Share Token Architecture
- **Vanity code**: 4-digit (0000-9999) for display/memorability
- **Share token**: 12-character alphanumeric (e.g., `a1B2c3D4e5F6`)
- **Full share URL**: `composer.design/1234/a1B2c3D4e5F6` (path-based, no query string)
- Access requires valid token - code alone is insufficient
- Prevents enumeration (62^12 = 3.2 quintillion possibilities)
- Path-based token reduces (but doesn't eliminate) leakage risk
- **Required**: Set `Referrer-Policy: same-origin` on share pages
- **Required**: No third-party scripts/resources on share pages

### Access Levels
- **No token**: Cannot access flow
- **Valid token**: Full collaboration access (view + edit everything including prompts)
- **Owner**: Full access + can unpublish/delete

### ⚠️ Security Note
Collaborators with the share token can edit ALL flow content including prompts, system instructions, and model settings. The share token effectively grants full edit access. Only share links with trusted collaborators.

### Data Columns
- `flow_nodes.data` - UI state (labels, selection state)
- `flow_nodes.private_data` - Content (prompts, system instructions, model settings)
- Both columns accessible to anyone with share token
- Separation exists for future read-only sharing mode (not implemented)

### Execution Controls
- `flows.allow_public_execute` - Boolean toggle (default: false)
- Per-flow daily execution quota (e.g., 100 runs/day)
- Rate limit: 10 requests/minute per flow
- Owner can disable public execution anytime

### API Key Strategy (Dual-Source)
- **Signed-out users**: Keys stored in browser localStorage, sent via request headers
- **Signed-in users**: Can optionally store keys encrypted server-side (`user_api_keys` table)
- **NEVER** stored in flow data (`private_data` contains prompts/settings only)

### Owner-Funded Execution
- `flows.use_owner_keys` - Boolean toggle (default: false, requires signed-in owner)
- When enabled, collaborators can run flows using owner's stored server-side keys
- Owner stores keys encrypted in `user_api_keys` table (AES-256-GCM)
- **Required env var**: `ENCRYPTION_KEY` - 32-byte hex string for key encryption
- Keys are decrypted server-side only during execution, never sent to client
- Owner can revoke by disabling toggle or deleting stored keys

### Key Resolution Order (Execution)
1. If `use_owner_keys` is true → use owner's server-stored keys (if available)
2. Else → use keys from request headers (collaborator's localStorage keys)
3. If neither available → return error

---

## Phase 1: Database Schema

### Migration 1: Add share columns to `flows` table

```sql
-- Add live sharing columns
ALTER TABLE public.flows
ADD COLUMN live_id TEXT UNIQUE,                    -- 4-digit vanity code
ADD COLUMN share_token TEXT UNIQUE,                -- 12-char secret token
ADD COLUMN allow_public_execute BOOLEAN DEFAULT false,
ADD COLUMN use_owner_keys BOOLEAN DEFAULT false,   -- Collaborators use owner's stored API keys
ADD COLUMN daily_execution_count INTEGER DEFAULT 0,
ADD COLUMN daily_execution_reset TIMESTAMPTZ DEFAULT now();

-- Validate 4-digit format
ALTER TABLE public.flows
ADD CONSTRAINT flows_live_id_format
CHECK (live_id IS NULL OR live_id ~ '^[0-9]{4}$');

-- Validate 12-char alphanumeric token
ALTER TABLE public.flows
ADD CONSTRAINT flows_share_token_format
CHECK (share_token IS NULL OR share_token ~ '^[a-zA-Z0-9]{12}$');

-- Index for fast lookup by share_token (this is what we actually query)
CREATE INDEX idx_flows_share_token ON public.flows(share_token) WHERE share_token IS NOT NULL;

-- NO public SELECT policy on flows table - use RPC instead
```

### Migration 2: Create `flow_nodes` table

```sql
CREATE TABLE public.flow_nodes (
  id TEXT NOT NULL,                    -- React Flow node ID (e.g., "node_1")
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                  -- Node type (text-input, text-generation, etc.)
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION,
  height DOUBLE PRECISION,
  data JSONB NOT NULL DEFAULT '{}',           -- UI state: labels, selection
  private_data JSONB NOT NULL DEFAULT '{}',   -- Content: prompts, system instructions, model settings (NEVER API keys)
  parent_id TEXT,                      -- For nodes inside comments
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (flow_id, id)
);

-- Enable RLS
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;

-- Owner can do everything (no public policy - use RPC)
CREATE POLICY "Owners can manage their flow nodes"
ON public.flow_nodes FOR ALL
USING (flow_id IN (SELECT id FROM public.flows WHERE user_id = auth.uid()));

-- NOTE: We use Broadcast for realtime sync, not table subscriptions
-- Table subscriptions won't work for anon collaborators due to RLS
```

### Migration 3: Create `flow_edges` table

```sql
CREATE TABLE public.flow_edges (
  id TEXT NOT NULL,                    -- React Flow edge ID
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL,
  source_handle TEXT,
  target_node_id TEXT NOT NULL,
  target_handle TEXT,
  edge_type TEXT DEFAULT 'colored',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),         -- Added for sync/conflict detection
  PRIMARY KEY (flow_id, id)
);

-- Enable RLS
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;

-- Owner can do everything (no public policy - use RPC)
CREATE POLICY "Owners can manage their flow edges"
ON public.flow_edges FOR ALL
USING (flow_id IN (SELECT id FROM public.flows WHERE user_id = auth.uid()));

-- NOTE: We use Broadcast for realtime sync, not table subscriptions
```

### Migration 4: Create security-definer RPC for public access

```sql
-- Secure function for token-gated access
-- Returns ALL data including private_data (collaborators have full edit access)
CREATE OR REPLACE FUNCTION public.get_live_flow(p_share_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow_id UUID;
  v_result JSON;
BEGIN
  -- Validate token format
  IF p_share_token IS NULL OR p_share_token !~ '^[a-zA-Z0-9]{12}$' THEN
    RETURN NULL;
  END IF;

  -- Get flow ID (exact match only)
  SELECT id INTO v_flow_id
  FROM flows
  WHERE share_token = p_share_token;

  IF v_flow_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build response with ALL data (collaborators have full edit access)
  SELECT json_build_object(
    'flow', (SELECT row_to_json(f) FROM (
      SELECT id, name, description, live_id, allow_public_execute, created_at, updated_at
      FROM flows WHERE id = v_flow_id
    ) f),
    'nodes', (SELECT json_agg(row_to_json(n)) FROM (
      SELECT id, type, position_x, position_y, width, height, data, private_data, parent_id
      FROM flow_nodes WHERE flow_id = v_flow_id
    ) n),
    'edges', (SELECT json_agg(row_to_json(e)) FROM (
      SELECT id, source_node_id, source_handle, target_node_id, target_handle, edge_type, data
      FROM flow_edges WHERE flow_id = v_flow_id
    ) e)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_live_flow(TEXT) TO anon, authenticated;
```

### Migration 5: Create atomic execution quota RPC

```sql
-- Atomically check and increment execution quota
CREATE OR REPLACE FUNCTION public.execute_live_flow_check(
  p_share_token TEXT,
  p_daily_limit INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Get flow and lock row for update
  SELECT id, allow_public_execute, daily_execution_count, daily_execution_reset
  INTO v_flow
  FROM flows
  WHERE share_token = p_share_token
  FOR UPDATE;

  IF v_flow IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'Flow not found');
  END IF;

  IF NOT v_flow.allow_public_execute THEN
    RETURN json_build_object('allowed', false, 'reason', 'Public execution disabled');
  END IF;

  -- Reset counter if new day
  IF v_flow.daily_execution_reset < v_now - INTERVAL '1 day' THEN
    UPDATE flows
    SET daily_execution_count = 1, daily_execution_reset = v_now
    WHERE id = v_flow.id;
    RETURN json_build_object('allowed', true, 'remaining', p_daily_limit - 1);
  END IF;

  -- Check quota
  IF v_flow.daily_execution_count >= p_daily_limit THEN
    RETURN json_build_object('allowed', false, 'reason', 'Daily quota exceeded');
  END IF;

  -- Increment counter
  UPDATE flows
  SET daily_execution_count = daily_execution_count + 1
  WHERE id = v_flow.id;

  RETURN json_build_object('allowed', true, 'remaining', p_daily_limit - v_flow.daily_execution_count - 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_live_flow_check(TEXT, INTEGER) TO anon, authenticated;
```

### Migration 6: Create collaboration update RPC

```sql
-- Token-gated write access for collaboration
-- Handles upserts AND deletes for nodes/edges + flow metadata
-- IMPORTANT: Requires FULL node payloads for inserts (position_x/y required)
--            Use this for batch updates, not delta/partial updates
CREATE OR REPLACE FUNCTION public.update_live_flow(
  p_share_token TEXT,
  p_nodes JSONB DEFAULT '[]',                   -- Full node objects to upsert
  p_edges JSONB DEFAULT '[]',                   -- Full edge objects to upsert
  p_deleted_node_ids TEXT[] DEFAULT '{}',       -- Node IDs to delete (also deletes connected edges)
  p_deleted_edge_ids TEXT[] DEFAULT '{}',       -- Edge IDs to delete
  p_name TEXT DEFAULT NULL,                     -- Flow metadata: name
  p_description TEXT DEFAULT NULL,              -- Flow metadata: description
  p_allow_public_execute BOOLEAN DEFAULT NULL   -- Flow metadata: execution toggle
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flow_id UUID;
BEGIN
  -- Validate token and get flow_id
  SELECT id INTO v_flow_id
  FROM flows
  WHERE share_token = p_share_token;

  IF v_flow_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- Update flow metadata if provided
  IF p_name IS NOT NULL OR p_description IS NOT NULL OR p_allow_public_execute IS NOT NULL THEN
    UPDATE flows SET
      name = COALESCE(p_name, name),
      description = COALESCE(p_description, description),
      allow_public_execute = COALESCE(p_allow_public_execute, allow_public_execute),
      updated_at = now()
    WHERE id = v_flow_id;
  END IF;

  -- Delete edges connected to deleted nodes (prevents orphans)
  IF array_length(p_deleted_node_ids, 1) > 0 THEN
    DELETE FROM flow_edges
    WHERE flow_id = v_flow_id
      AND (source_node_id = ANY(p_deleted_node_ids) OR target_node_id = ANY(p_deleted_node_ids));
  END IF;

  -- Delete nodes
  IF array_length(p_deleted_node_ids, 1) > 0 THEN
    DELETE FROM flow_nodes
    WHERE flow_id = v_flow_id AND id = ANY(p_deleted_node_ids);
  END IF;

  -- Delete edges explicitly requested
  IF array_length(p_deleted_edge_ids, 1) > 0 THEN
    DELETE FROM flow_edges
    WHERE flow_id = v_flow_id AND id = ANY(p_deleted_edge_ids);
  END IF;

  -- Upsert nodes (COALESCE handles NULL input)
  -- IMPORTANT: INSERT requires position_x/y - send full node objects, not deltas
  INSERT INTO flow_nodes (id, flow_id, type, position_x, position_y, width, height, data, private_data, parent_id, updated_at)
  SELECT
    (node->>'id')::TEXT,
    v_flow_id,
    COALESCE((node->>'type')::TEXT, 'unknown'),
    (node->>'position_x')::DOUBLE PRECISION,
    (node->>'position_y')::DOUBLE PRECISION,
    (node->>'width')::DOUBLE PRECISION,
    (node->>'height')::DOUBLE PRECISION,
    COALESCE(node->'data', '{}'),
    COALESCE(node->'private_data', '{}'),
    (node->>'parent_id')::TEXT,
    now()
  FROM jsonb_array_elements(COALESCE(p_nodes, '[]'::jsonb)) AS node
  ON CONFLICT (flow_id, id) DO UPDATE SET
    type = COALESCE(EXCLUDED.type, flow_nodes.type),
    position_x = COALESCE(EXCLUDED.position_x, flow_nodes.position_x),
    position_y = COALESCE(EXCLUDED.position_y, flow_nodes.position_y),
    width = COALESCE(EXCLUDED.width, flow_nodes.width),
    height = COALESCE(EXCLUDED.height, flow_nodes.height),
    data = COALESCE(EXCLUDED.data, flow_nodes.data),
    private_data = COALESCE(EXCLUDED.private_data, flow_nodes.private_data),
    parent_id = EXCLUDED.parent_id,
    updated_at = now();

  -- Upsert edges
  INSERT INTO flow_edges (id, flow_id, source_node_id, source_handle, target_node_id, target_handle, edge_type, data, updated_at)
  SELECT
    (edge->>'id')::TEXT,
    v_flow_id,
    (edge->>'source_node_id')::TEXT,
    (edge->>'source_handle')::TEXT,
    (edge->>'target_node_id')::TEXT,
    (edge->>'target_handle')::TEXT,
    COALESCE((edge->>'edge_type')::TEXT, 'colored'),
    COALESCE(edge->'data', '{}'),
    now()
  FROM jsonb_array_elements(COALESCE(p_edges, '[]'::jsonb)) AS edge
  ON CONFLICT (flow_id, id) DO UPDATE SET
    source_node_id = EXCLUDED.source_node_id,
    source_handle = EXCLUDED.source_handle,
    target_node_id = EXCLUDED.target_node_id,
    target_handle = EXCLUDED.target_handle,
    edge_type = EXCLUDED.edge_type,
    data = EXCLUDED.data,
    updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_live_flow(TEXT, JSONB, JSONB, TEXT[], TEXT[], TEXT, TEXT, BOOLEAN) TO anon, authenticated;
```

### Migration 7: Create `user_api_keys` table for owner-funded execution

```sql
-- Store encrypted API keys for authenticated users
-- Used when collaborators run flows with use_owner_keys = true
CREATE TABLE public.user_api_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  keys_encrypted TEXT NOT NULL,      -- AES-256-GCM encrypted JSON: { openai?, google?, anthropic? }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS - only owner can access their own keys
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own keys"
ON public.user_api_keys FOR ALL
USING (user_id = auth.uid());

-- RPC to get owner's keys for execution (called server-side only)
-- Returns NULL if keys not stored or use_owner_keys is false
CREATE OR REPLACE FUNCTION public.get_owner_keys_for_execution(p_share_token TEXT)
RETURNS TEXT  -- Returns encrypted keys blob (decryption happens server-side)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_use_owner_keys BOOLEAN;
  v_keys TEXT;
BEGIN
  -- Get flow owner and check if owner keys are enabled
  SELECT user_id, use_owner_keys INTO v_owner_id, v_use_owner_keys
  FROM flows
  WHERE share_token = p_share_token;

  IF v_owner_id IS NULL OR NOT v_use_owner_keys THEN
    RETURN NULL;
  END IF;

  -- Get owner's encrypted keys
  SELECT keys_encrypted INTO v_keys
  FROM user_api_keys
  WHERE user_id = v_owner_id;

  RETURN v_keys;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_keys_for_execution(TEXT) TO anon, authenticated;
```

---

## Phase 2: API Routes

### Terminology
- **code**: 4-digit vanity display code (used in URL path for memorability)
- **token**: 12-char secret (used for API access and authentication)
- API routes use `[token]` parameter for security lookups
- URL paths use `/[code]/[token]` for user-friendly display

### New Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/live/[token]` | GET | Token | Get flow via share token (calls RPC) |
| `/api/live/[token]` | PUT | Token | Update flow (collaboration) |
| `/api/live/[token]/execute` | POST | Token | Execute flow (uses owner's keys if enabled) |
| `/api/flows/[id]/publish` | POST | Owner | Generate live_id + share_token |
| `/api/flows/[id]/publish` | DELETE | Owner | Remove live_id (unpublish) |
| `/api/user/keys` | GET | Owner | Get stored key status (not the keys themselves) |
| `/api/user/keys` | PUT | Owner | Store encrypted API keys server-side |
| `/api/user/keys` | DELETE | Owner | Remove stored API keys |

### `/api/live/[token]/route.ts` Implementation

```typescript
// GET - Read flow via token
const { data, error } = await supabase.rpc('get_live_flow', {
  p_share_token: token
});

if (!data) {
  return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
}

return NextResponse.json({ success: true, ...data });

// PUT - Update flow (collaboration)
// Token grants edit access, validate and update nodes/edges
```

### `/api/live/[token]/execute/route.ts` Implementation

```typescript
// Check if execution is allowed + enforce quota atomically
const { data: quota, error } = await supabase.rpc('execute_live_flow_check', {
  p_share_token: token,
  p_daily_limit: 100
});

if (error || !quota.allowed) {
  return NextResponse.json({
    error: quota?.reason || 'Execution not allowed'
  }, { status: 403 });
}

// Try to get owner's stored keys (if use_owner_keys is enabled)
const { data: encryptedKeys } = await supabase.rpc('get_owner_keys_for_execution', {
  p_share_token: token
});

let apiKeys: ApiKeys;
if (encryptedKeys) {
  // Decrypt owner's keys server-side
  apiKeys = decryptKeys(encryptedKeys, process.env.ENCRYPTION_KEY!);
} else {
  // Fall back to keys from request headers (collaborator's own keys)
  apiKeys = getKeysFromHeaders(request);
  if (!apiKeys.hasAny) {
    return NextResponse.json({
      error: 'No API keys available. Owner has not enabled shared keys.'
    }, { status: 400 });
  }
}

// Execute flow with resolved keys
// Return outputs only
```

### `/api/user/keys/route.ts` Implementation

```typescript
// PUT - Store encrypted API keys
const { openai, google, anthropic } = await request.json();

const keysJson = JSON.stringify({ openai, google, anthropic });
const encrypted = encryptKeys(keysJson, process.env.ENCRYPTION_KEY!);

const { error } = await supabase
  .from('user_api_keys')
  .upsert({
    user_id: user.id,
    keys_encrypted: encrypted,
    updated_at: new Date().toISOString()
  });

// GET - Return which providers have keys stored (not the keys themselves)
const { data } = await supabase
  .from('user_api_keys')
  .select('keys_encrypted')
  .eq('user_id', user.id)
  .single();

if (data) {
  const keys = decryptKeys(data.keys_encrypted, process.env.ENCRYPTION_KEY!);
  return { hasOpenai: !!keys.openai, hasGoogle: !!keys.google, hasAnthropic: !!keys.anthropic };
}
```

### Key Files to Create

- `app/api/live/[token]/route.ts` - Read/update via RPC
- `app/api/live/[token]/execute/route.ts` - Guarded execution with atomic quota + owner keys
- `app/api/flows/[id]/publish/route.ts` - Publish/unpublish (returns token to owner)
- `app/api/user/keys/route.ts` - Store/retrieve/delete encrypted API keys
- `lib/encryption.ts` - AES-256-GCM encrypt/decrypt helpers

---

## Phase 3: URL Routing

### URL Structure

- **Share URL**: `composer.design/1234/a1B2c3D4e5F6` (path-based)
  - `1234` = vanity code (for display/memorability)
  - `a1B2c3D4e5F6` = share token (grants access)
- **Editor**: `/` (existing)
- **Canonical redirect**: If code doesn't match live_id, redirect to correct URL

### Routing Logic

```
/[code]/[token]/page.tsx:
1. Extract code and token from path segments
2. Call /api/live/[token] to fetch flow
3. If not found → 404
4. If code doesn't match flow.live_id → redirect to /{live_id}/{token}
5. Render collaborative editor (full AgentFlow, not read-only)
```

### Files to Create

- `app/[code]/[token]/page.tsx` - Collaborative flow editor page
- Reuses existing `AgentFlow.tsx` with collaboration mode enabled

---

## Phase 4: Client Updates

### Type Updates (`lib/flows/types.ts`)

```typescript
interface FlowRecord {
  // ... existing fields
  live_id: string | null;      // ADD - 4-digit vanity code
  share_token: string | null;  // ADD - 12-char secret (only returned to owner)
  allow_public_execute: boolean;
  use_owner_keys: boolean;     // ADD - Collaborators use owner's stored API keys
}

interface FlowNodeRecord {
  id: string;
  flow_id: string;
  type: string;
  position_x: number;
  position_y: number;
  width?: number;
  height?: number;
  data: Record<string, unknown>;
  parent_id?: string;
}

interface FlowEdgeRecord {
  id: string;
  flow_id: string;
  source_node_id: string;
  source_handle?: string;
  target_node_id: string;
  target_handle?: string;
  edge_type?: string;
  data?: Record<string, unknown>;
}
```

### New API Functions (`lib/flows/api.ts`)

- `publishFlow(id)` - POST to `/api/flows/[id]/publish` → returns `{ live_id, share_token }`
- `unpublishFlow(id)` - DELETE to `/api/flows/[id]/publish`
- `loadLiveFlow(token)` - GET from `/api/live/[token]` (returns full flow including private_data)
- `updateLiveFlow(token, changes)` - PUT to `/api/live/[token]`
  - `changes.nodes` - Full node objects to upsert (must include position_x/y for new nodes)
  - `changes.edges` - Full edge objects to upsert
  - `changes.deletedNodeIds` - Node IDs to delete (connected edges auto-deleted)
  - `changes.deletedEdgeIds` - Edge IDs to delete
  - `changes.name` - Optional flow name update
  - `changes.description` - Optional flow description update
  - `changes.allowPublicExecute` - Optional execution toggle update
- `executeLiveFlow(token, inputs)` - POST to `/api/live/[token]/execute`

### Hook Updates (`lib/hooks/useFlowOperations.ts`)

- Add `currentLiveId` state
- Add `handlePublishFlow()` handler
- Update save/load to sync nodes/edges to DB tables

---

## Phase 5: UI Changes

### Flow Dropdown Menu

Add "Go Live" / "Share" option:
- If not published: "Go Live" button generates live_id
- If published: Shows share dialog with copyable URL

### Share Dialog (`components/Flow/ShareDialog.tsx`)

- Displays full URL: `composer.design/[code]/[token]`
- Copy button (copies full URL with token)
- Open in new tab link
- Warning: "Anyone with this link can edit your flow"
- **Toggle: "Let collaborators run with my API keys"** (`use_owner_keys`)
  - If enabled and no keys stored → prompt to store keys first
  - Shows which providers have keys stored
- QR code (optional)

### Settings Dialog Updates

Add new section to API Keys tab (only visible when signed in):
- **"Store keys for collaboration"** - Save encrypted keys server-side
- Shows status: "Keys stored for: OpenAI, Google" (checkmarks)
- "Remove stored keys" button
- Note: "Stored keys are encrypted and only used when you enable 'Let collaborators run with my API keys' on a shared flow"
- Signed-out users: Section hidden, keys only in localStorage (existing behavior)

---

## Phase 6: MCP Integration (Future)

MCP server that exposes:
- `read_flow` tool - Returns flow structure by code
- `execute_flow` tool - Runs flow with inputs, returns outputs
- `list_inputs` tool - Returns required inputs for a flow
- `list_outputs` tool - Returns output schema for a flow

---

## Implementation Order

### Step 1: Database migrations
1. Add `live_id`, `share_token`, `use_owner_keys`, execution control columns to `flows` table
2. Create `flow_nodes` table with owner-only RLS (no public policy)
3. Create `flow_edges` table with owner-only RLS (no public policy)
4. Create `get_live_flow` RPC for token-gated read (returns ALL data including private_data)
5. Create `execute_live_flow_check` RPC for atomic quota enforcement
6. Create `update_live_flow` RPC for token-gated writes (full edit access including private_data)
7. Create `user_api_keys` table for encrypted key storage
8. Create `get_owner_keys_for_execution` RPC

### Step 2: Migrate existing flows
- Create one-time migration script to read existing JSON blobs from Storage
- Parse nodes/edges and insert into new tables
- **Data mapping for migration:**
  - `position_x`, `position_y`, `width`, `height` → dedicated columns (NOT in data JSONB)
  - `type` → dedicated column
  - `data` (public): `{ label, selected, dragging }` (UI state only)
  - `private_data` (private): `{ userPrompt, systemPrompt, model, provider, verbosity, thinking, googleThinkingConfig, ... }`
- Keep Storage files as backup until verified

### Step 3: Update save/load logic
- Modify `POST /api/flows` to save nodes/edges to DB tables
- Modify `GET /api/flows/[id]` to load from DB tables
- Modify `PUT /api/flows/[id]` to update DB tables
- Update client-side types and API functions

### Step 4: Public API routes + key management
- Create `GET /api/live/[token]` for token-gated flow read
- Create `PUT /api/live/[token]` for token-gated collaboration updates
- Create `POST /api/flows/[id]/publish` for generating live_id + share_token
- Create `DELETE /api/flows/[id]/publish` for unpublishing
- Create `lib/encryption.ts` with AES-256-GCM helpers
- Create `/api/user/keys` for storing/retrieving encrypted API keys

### Step 5: URL routing & collaboration page
- Create `/[code]/[token]/page.tsx` dynamic route
- Reuse `AgentFlow.tsx` in collaboration mode (full edit access)
- Add collaboration state management (broadcast channel, presence)
- All collaborators have equal edit access (prompts, settings, layout)

### Step 6: UI integration
- Add "Go Live" option to Flow dropdown menu
- Create `ShareDialog.tsx` with full URL including token
- Add "Let collaborators run with my API keys" toggle in share dialog
- Update Settings Dialog with "Store keys for collaboration" section
- Show live_id badge when flow is published
- Add "Collaborating" indicator when multiple users present

### Step 7: Execute endpoint (for MCP + collaborators)
- Create `POST /api/live/[token]/execute`
- Check `use_owner_keys` flag → fetch and decrypt owner's keys if enabled
- Fall back to collaborator's keys from headers if owner keys not available
- Accept inputs, run flow, return outputs
- Rate limiting + daily quota enforcement

### Step 8: MCP server (future)
- Separate package exposing tools for reading/executing flows

---

## Realtime Collaboration Strategy

### Access Model: Open Collaboration
- Anyone with the share link (`/1234/a1B2c3D4e5F6`) can edit
- No invite system needed - share token = edit access
- Owner retains ability to unpublish (revoke all access)

### Problem
React Flow drag/resize events fire rapidly (60+ times/second). Writing every update to DB would:
- Overwhelm Supabase with writes
- Cause jitter from last-write-wins conflicts
- Incur unnecessary costs

### Solution: Hybrid Approach

**1. Optimistic Local State**
- All node/edge changes update local React state immediately
- No network latency for interactions

**2. Debounced Persistence (500ms)**
- Batch position/size changes via `update_live_flow` RPC
- Only persist after user stops dragging
- Use `updated_at` for conflict detection

**3. Realtime Sync (Broadcast-Only)**
- **Why not table subscriptions?** RLS on `flow_nodes`/`flow_edges` is owner-only. Supabase Realtime enforces RLS, so anon token users won't receive updates from table subscriptions.
- **Solution**: Use Broadcast channel for ALL data sync (not just presence)
- When a user saves changes via `update_live_flow` RPC, they also broadcast the delta to the channel
- Other collaborators receive the broadcast and merge into local state
- Channel name: `flow:{share_token}` (token-scoped, not flow_id)

**4. Realtime Presence (Broadcast)**
- Same Broadcast channel carries presence data:
  - Cursor positions
  - Selection state
  - "User is typing" indicators
  - Active user list
- No DB writes for presence data

**5. Broadcast Message Types**
```typescript
// NOTE: Send FULL node/edge payloads, not deltas (RPC requires position_x/y for inserts)
type BroadcastMessage =
  | { type: 'nodes_updated', nodes: FullNodePayload[] }
  | { type: 'edges_updated', edges: FullEdgePayload[] }
  | { type: 'nodes_deleted', nodeIds: string[] }  // Plural - batch deletes
  | { type: 'edges_deleted', edgeIds: string[] }  // Plural - batch deletes
  | { type: 'metadata_updated', name?: string, description?: string, allowPublicExecute?: boolean }
  | { type: 'cursor_moved', userId: string, position: { x: number, y: number } }
  | { type: 'user_joined', userId: string, name?: string }
  | { type: 'user_left', userId: string };
```

**6. Conflict Resolution**
- Compare `updated_at` timestamps
- If local is older, merge remote changes
- For concurrent edits to same node: last-write-wins with toast notification

### Implementation Pattern

```typescript
// Debounced batch save for position changes (uses RPC, not direct table access)
const debouncedSaveChanges = useMemo(
  () => debounce((changedNodes: FlowNode[]) => {
    // Convert to full node payloads for RPC
    const nodePayloads = changedNodes.map(node => ({
      id: node.id,
      type: node.type,
      position_x: node.position.x,
      position_y: node.position.y,
      width: node.width,
      height: node.height,
      data: node.data,
      private_data: node.privateData,
      parent_id: node.parentId,
    }));

    supabase.rpc('update_live_flow', {
      p_share_token: shareToken,
      p_nodes: nodePayloads,
    });

    // Also broadcast to other collaborators
    broadcastChannel.send({
      type: 'broadcast',
      event: 'nodes_updated',
      payload: { nodes: nodePayloads }
    });
  }, 500),
  [shareToken]
);

// Immediate save for content changes (prompts, settings, metadata)
const saveContentChanges = (
  nodes: FlowNode[],
  metadata?: { name?: string; description?: string; allowPublicExecute?: boolean }
) => {
  const nodePayloads = nodes.map(node => ({
    id: node.id,
    type: node.type,
    position_x: node.position.x,
    position_y: node.position.y,
    data: node.data,
    private_data: node.privateData,
  }));

  supabase.rpc('update_live_flow', {
    p_share_token: shareToken,
    p_nodes: nodePayloads,
    p_name: metadata?.name,
    p_description: metadata?.description,
    p_allow_public_execute: metadata?.allowPublicExecute,
  });

  // Broadcast content changes immediately
  broadcastChannel.send({
    type: 'broadcast',
    event: 'nodes_updated',
    payload: { nodes: nodePayloads, metadata }
  });
};
```

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `lib/flows/types.ts` | Add `live_id`, node/edge record types |
| `lib/flows/api.ts` | Add publish, load live, execute functions |
| `lib/hooks/useFlowOperations.ts` | Add live_id state, publish handler |
| `app/api/flows/route.ts` | Update to save nodes/edges to DB |
| `app/api/flows/[id]/route.ts` | Update to load/save from DB tables |
| `components/Flow/AgentFlow.tsx` | Add Go Live menu item |

## New Files to Create

| File | Purpose |
|------|---------|
| `app/api/live/[token]/route.ts` | Token-gated flow read/update |
| `app/api/live/[token]/execute/route.ts` | Token-gated flow execution with owner keys |
| `app/api/flows/[id]/publish/route.ts` | Publish/unpublish (owner only) |
| `app/api/user/keys/route.ts` | Store/retrieve encrypted API keys |
| `app/[code]/[token]/page.tsx` | Collaborative flow editor page |
| `components/Flow/ShareDialog.tsx` | Share URL dialog with owner keys toggle |
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt helpers |

---

## Testing Strategy

### Unit Tests (`lib/hooks/__tests__/`)

- `useLiveFlow.test.ts` - Test token-based loading and updates
- `useCollaboration.test.ts` - Test realtime sync and conflict resolution

### Integration Tests

```typescript
// Test RPC returns all data for valid token
describe('get_live_flow RPC', () => {
  it('should return all data including private_data for valid token', async () => {
    const result = await supabase.rpc('get_live_flow', { p_share_token: validToken });
    expect(result.nodes[0].private_data).toBeDefined();  // Full edit access
    expect(result.nodes[0].data).toBeDefined();
    expect(result.flow.name).toBeDefined();
  });

  it('should return null for invalid token', async () => {
    const result = await supabase.rpc('get_live_flow', { p_share_token: 'invalid' });
    expect(result).toBeNull();
  });
});

// Test atomic quota enforcement
describe('execute_live_flow_check RPC', () => {
  it('should atomically increment and check quota', async () => {
    // Simulate concurrent requests
    const results = await Promise.all([
      supabase.rpc('execute_live_flow_check', { p_share_token: token, p_daily_limit: 2 }),
      supabase.rpc('execute_live_flow_check', { p_share_token: token, p_daily_limit: 2 }),
      supabase.rpc('execute_live_flow_check', { p_share_token: token, p_daily_limit: 2 }),
    ]);

    const allowed = results.filter(r => r.data?.allowed);
    expect(allowed.length).toBe(2); // Only 2 should succeed
  });
});

// Test collaboration access
describe('update_live_flow RPC', () => {
  it('should allow node updates with valid token', async () => {
    const result = await supabase.rpc('update_live_flow', {
      p_share_token: validToken,
      p_nodes: [{
        id: 'node_1',
        type: 'text-generation',
        position_x: 100,
        position_y: 200,
        data: { label: 'Test' },
        private_data: { userPrompt: 'Hello', systemPrompt: 'Be helpful' }
      }],
      p_edges: []
    });
    expect(result.data.success).toBe(true);
  });

  it('should allow metadata updates with valid token', async () => {
    const result = await supabase.rpc('update_live_flow', {
      p_share_token: validToken,
      p_name: 'Renamed Flow',
      p_description: 'Updated description',
      p_allow_public_execute: true
    });
    expect(result.data.success).toBe(true);

    // Verify metadata was updated
    const flow = await supabase.rpc('get_live_flow', { p_share_token: validToken });
    expect(flow.data.flow.name).toBe('Renamed Flow');
    expect(flow.data.flow.allow_public_execute).toBe(true);
  });

  it('should auto-delete orphan edges when nodes are deleted', async () => {
    const result = await supabase.rpc('update_live_flow', {
      p_share_token: validToken,
      p_deleted_node_ids: ['node_1']  // Has edges connected to it
    });
    expect(result.data.success).toBe(true);

    // Edges referencing deleted node should be gone
    const flow = await supabase.rpc('get_live_flow', { p_share_token: validToken });
    const orphanEdges = flow.data.edges?.filter(
      e => e.source_node_id === 'node_1' || e.target_node_id === 'node_1'
    );
    expect(orphanEdges?.length ?? 0).toBe(0);
  });

  it('should reject updates with invalid token', async () => {
    const result = await supabase.rpc('update_live_flow', {
      p_share_token: 'invalid',
      p_nodes: [],
      p_edges: []
    });
    expect(result.data.success).toBe(false);
  });
});

// Test owner-funded execution
describe('get_owner_keys_for_execution RPC', () => {
  it('should return encrypted keys when use_owner_keys is true', async () => {
    // Setup: owner has stored keys and enabled use_owner_keys on flow
    const result = await supabase.rpc('get_owner_keys_for_execution', {
      p_share_token: tokenWithOwnerKeys
    });
    expect(result.data).not.toBeNull();  // Returns encrypted blob
  });

  it('should return null when use_owner_keys is false', async () => {
    const result = await supabase.rpc('get_owner_keys_for_execution', {
      p_share_token: tokenWithoutOwnerKeys
    });
    expect(result.data).toBeNull();
  });

  it('should return null when owner has no stored keys', async () => {
    const result = await supabase.rpc('get_owner_keys_for_execution', {
      p_share_token: tokenWithNoStoredKeys
    });
    expect(result.data).toBeNull();
  });
});
```

### Manual Testing Checklist

- [ ] Publish flow → receive live_id and share_token
- [ ] Share URL works for anonymous users
- [ ] Token-only access (code mismatch redirects)
- [ ] Collaboration: multiple users can edit nodes, edges, prompts, settings
- [ ] Collaboration: users can update flow name/description
- [ ] Execute quota enforced correctly
- [ ] API keys never stored in flow data (localStorage for signed-out, server-side for signed-in)
- [ ] Unpublish removes access
- [ ] Deleting a node also deletes its connected edges
- [ ] Owner can store API keys in Settings → shows checkmarks for stored providers
- [ ] Owner can enable "Let collaborators run with my API keys" in Share dialog
- [ ] Collaborator can run flow using owner's keys (no API key setup needed)
- [ ] Collaborator without keys sees error if owner keys not enabled
- [ ] Owner can remove stored keys → collaborators fall back to needing own keys
