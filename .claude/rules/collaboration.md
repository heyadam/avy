# Publishing & Owner-Funded Execution

> Composer no longer ships a real-time multiplayer layer. The hooks that used to
> handle Supabase Presence/Broadcast (`useCollaboration`, `CollaboratorCursors`,
> `usePerfectCursor`) have been removed, along with the `/f/[code]/[token]`
> collaborator page and the `/api/live/*` routes. What remains is the
> publishing pipeline that lets external clients (primarily the MCP server) run
> a saved flow using the owner's credentials.

## Publish / Unpublish Flow

**ShareDialog** (`components/Flow/ShareDialog.tsx`): the single entry point for
publishing settings.
- Saves an unnamed flow if it has not been persisted yet
- Shows the MCP endpoint and the flow's share token (used by `run_flow` /
  `get_flow_info`)
- Toggles owner-funded execution

**Share Button** (`components/Flow/FlowHeader/LeftControls.tsx`): opens
`ShareDialog`. It turns cyan once the flow is published so the owner can tell
at a glance whether a flow is live.

**Publish API Route** (`app/api/flows/[id]/publish/route.ts`):
- `POST` creates a `live_id` + `share_token` pair and enables
  `allow_public_execute` / `use_owner_keys` by default
- `DELETE` unpublishes and clears all four fields
- `PATCH` updates `use_owner_keys` and `allow_public_execute` after publish

## Owner-Funded Execution

When `use_owner_keys=true`, MCP clients can run the flow without bringing their
own API keys — the owner's encrypted keys are decrypted server-side.

**Security model**:
- Keys stored encrypted in `user_api_keys.keys_encrypted`
- Decryption only happens server-side with `ENCRYPTION_KEY`
- The server validates `use_owner_keys` against the database (never trusts a
  client claim)
- Share tokens are secrets; they are redacted in debug panels and never logged

**Rate limiting** (Supabase RPCs):
- Per-minute: 10 runs per share token
- Per-day: 100 runs per flow
- Parallel node execution shares a `runId` so it counts as a single run

**Database RPCs**:
- `get_owner_keys_for_execution(p_share_token)` — returns encrypted keys when
  `use_owner_keys=true`
- `check_and_log_run(p_share_token, p_run_id, ...)` — atomic rate-limit check
  and logging

**Required env vars**:
- `SUPABASE_SERVICE_ROLE_KEY` — grants access to owner keys
- `ENCRYPTION_KEY` — 32-byte hex string for AES-256-GCM

See `.claude/rules/mcp.md` for how the MCP server consumes this pipeline.
