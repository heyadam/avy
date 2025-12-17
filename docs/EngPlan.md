# Engineering Plan: Avy Codebase Hardening

**Status:** In Progress
**Date:** 2025-12-16

---

## Executive Summary

This codebase was "vibe coded" and works on the happy path, but lacks defensive programming. The issues below are prioritized by risk and effort.

---

## P0: Critical (Fix immediately)

### 1. Magic Node Code Execution Security

**Location:** `app/api/execute/route.ts:360-409`

**Problem:** Claude-generated JavaScript runs via `new Function()` with regex validation.

**Status:** IMPROVED

**Changes Made:**
- Expanded forbidden patterns to catch more bypass attempts
- Added checks for: `constructor`, `__proto__`, `prototype`, `globalThis`, `self`
- Added checks for common infinite loop patterns (`while(true)`, `while(1)`, `for(;;)`)
- Added 500 character code length limit
- Added checks for bracket notation access to globals (`["eval"]` style)
- Blocked async/await keywords

**Remaining Risk:** True sandboxing requires Web Workers or iframe. Current approach is defense-in-depth, not a complete sandbox. Document this limitation for users.

---

## P1: High (Fix this week)

### 2. Error Boundary

**Location:** `app/error.tsx`

**Status:** COMPLETED

**Changes Made:**
- Created Next.js error boundary component
- Catches unhandled React errors
- Displays user-friendly error message with retry button
- Styled to match app theme

---

### 3. Flow Execution Cancellation

**Location:** `lib/execution/engine.ts`, `components/Flow/AgentFlow.tsx`

**Status:** COMPLETED

**Changes Made:**
- Added `signal?: AbortSignal` parameter to `executeFlow()`
- Created `abortControllerRef` in AgentFlow component
- Pass signal to all fetch calls in execution engine
- Check `signal.aborted` at start of each node execution
- Added cleanup effect to abort on component unmount
- Added Cancel button in ActionBar (red, shows when running)

---

### 4. Request Timeouts

**Location:** `lib/execution/engine.ts`

**Status:** COMPLETED

**Changes Made:**
- Created `fetchWithTimeout()` helper function
- Default timeout: 60 seconds for text generation
- Extended timeout: 120 seconds for image generation
- Combines user abort signal with timeout signal
- Clear error messages distinguish timeout vs user cancellation

---

## P2: Medium (Fix this month)

### 5. Promise.all Cascades Failures

**Location:** `lib/execution/engine.ts:411, 494, 517`

**Status:** PENDING

**Problem:** If any parallel node fails, all sibling nodes abort. No partial results preserved.

**Recommended Fix:** Use `Promise.allSettled()` and handle individual failures.

---

### 6. Unhandled Stream Errors

**Location:** `lib/execution/engine.ts:110-121, 234-265`

**Status:** PENDING

**Problem:** `reader.read()` can throw if stream is aborted or connection drops. No try-catch around the loop.

**Recommended Fix:** Wrap stream reading in try-catch, handle cleanup properly.

---

### 7. Silent Error Handling

**Location:** Throughout `lib/execution/engine.ts`

**Status:** PENDING

**Problem:** Errors go to `console.error()`. Users see nothing - flow just stops mysteriously.

**Recommended Fix:**
- Add error state to ResponsesSidebar
- Show toast notifications for failures
- Display error details with retry option

---

### 8. AbortController Memory Leaks

**Locations:**
- `lib/hooks/useAutopilotChat.ts`
- `lib/hooks/useCommentSuggestions.ts`

**Status:** PENDING

**Problem:** If component unmounts during fetch, AbortController isn't cleaned up. Request continues in background.

**Recommended Fix:** Add useEffect cleanup to abort on unmount.

---

### 9. No Runtime Validation

**Locations:**
- `app/api/execute/route.ts` - request body not validated
- `lib/flow-storage/validation.ts` - incomplete validation
- `lib/autopilot/parser.ts` - missing "comment" node type

**Status:** PENDING

**Problem:** TypeScript types aren't enforced at runtime. Malformed data could crash the app.

**Recommended Fix:** Add Zod schemas for API request/response bodies and flow data structures.

---

## P3: Low (Backlog)

### 10. Unbounded State Growth

**Location:** `AgentFlow.tsx:88-91`

**Status:** PENDING

**Problem:** `previewEntries` and `debugEntries` arrays grow unbounded in long sessions.

**Recommended Fix:** Limit to last 50-100 entries, prune on reset.

---

### 11. Multiple Sequential setNodes Calls

**Location:** `AgentFlow.tsx:243-518`

**Status:** PENDING

**Problem:** `handleNodesChange` makes 5+ separate `setNodes()` calls, causing unnecessary re-renders.

**Recommended Fix:** Batch into single state update.

---

### 12. No localStorage Debouncing

**Locations:**
- `components/Flow/ResponsesSidebar/ResponsesSidebar.tsx`
- `components/Flow/AutopilotSidebar/AutopilotSidebar.tsx`
- `lib/api-keys/context.tsx`

**Status:** PENDING

**Problem:** Every state change writes to localStorage synchronously. Performance issue during resize.

**Recommended Fix:** Debounce localStorage writes.

---

### 13. No Test Coverage

**Status:** PENDING

**Problem:** Zero test files in the codebase. Refactoring is risky.

**Recommended Fix:** Add tests for critical paths:
- Execution engine (unit tests)
- Flow validation (unit tests)
- API routes (integration tests)

---

## Files Modified (This Session)

| File | Change |
|------|--------|
| `app/error.tsx` | CREATED - Error boundary |
| `app/api/execute/route.ts` | EDITED - Improved magic node security patterns |
| `lib/execution/engine.ts` | EDITED - Added fetchWithTimeout, AbortSignal support |
| `components/Flow/AgentFlow.tsx` | EDITED - Added abort controller, cancel flow |
| `components/Flow/ActionBar.tsx` | EDITED - Added Cancel button |

---

## Testing Checklist

After implementation, verify:
- [ ] Error boundary catches React errors (throw in a component)
- [ ] Magic node rejects infinite loops (`while(true){}`)
- [ ] Cancel button aborts running flow
- [ ] Fetch timeout works (can test by throttling network)
- [ ] Component unmount aborts in-flight requests

---

## Architecture Notes

### Execution Flow

```
runFlow()
  └─> AbortController created
      └─> executeFlow(nodes, edges, callback, apiKeys, signal)
          └─> executeNodeAndContinue(node)
              ├─> Check signal.aborted
              └─> fetchWithTimeout("/api/execute", { signal })
                  ├─> Timeout after 60s (text) or 120s (image)
                  └─> Abort on user cancel
```

### Signal Propagation

The abort signal flows through:
1. `AgentFlow.tsx` creates `AbortController`
2. `executeFlow()` receives `signal` parameter
3. `executeNodeAndContinue()` checks `signal.aborted` before each node
4. `executeNode()` receives signal and passes to `fetchWithTimeout()`
5. `fetchWithTimeout()` combines user signal with timeout signal

---

## Known Limitations

1. **Magic Node Security:** Current regex-based validation is defense-in-depth, not a true sandbox. Sophisticated attacks may bypass it. For full security, implement Web Worker isolation.

2. **Synchronous Code Timeout:** JavaScript cannot truly timeout synchronous code without Web Workers. If generated code has an infinite loop, it will freeze the browser until manually killed.

3. **Stream Error Handling:** Stream reading loops don't have comprehensive try-catch. Network errors during streaming may leave the UI in an inconsistent state.
