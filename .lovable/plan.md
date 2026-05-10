## RS.M2 — Granular error responses for `parse-travel-story`

**Target:** `supabase/functions/parse-travel-story/index.ts` lines 191–194 (the inner `catch (parseError)` around the `JSON.parse` of the AI response).

### Current behavior
The inner catch logs the bad content, then `throw`s a generic `Error`, which is caught by the outer `catch` at line 230 and returned as a flat `{ error: "Story analysis failed", code: "PARSE_ERROR" }` with **HTTP 500**. The frontend cannot distinguish malformed AI output from a real network/timeout failure, so it shows one generic error.

### Change
Replace lines 191–194 with a categorized inline `return new Response(...)` (HTTP **422**) that classifies `parseError` into one of:

- `malformed_response` — `SyntaxError` or message includes `'JSON'` (the dominant case here, since the only thing in `try` is `JSON.parse`).
- `timeout` — message includes `'timeout'` / `'AbortError'`.
- `network` — message includes `'network'` / `'fetch'`.
- `low_confidence` — guarded by `analysisResult?.confidence < 30`. Note: in this scope no parsed result exists, so this branch is effectively dormant for the inner catch but is kept verbatim per the spec so the same shape can be reused if we later add a post-parse confidence gate. We'll declare `const analysisResult: any = undefined;` to keep TS happy without changing semantics.
- `unknown` — fallback.

Response body shape:
```json
{ "error": "<user-facing message>", "code": "MALFORMED_RESPONSE" | "TIMEOUT" | ..., "debug": "<first 200 chars of parseError.message>" }
```
Status: **422** (the outer 500 catch remains as a last-resort safety net for unexpected throws elsewhere).

### Out of scope
- The outer `catch (error)` at line 230 stays as-is (still returns 500 / `PARSE_ERROR`) — it's a different layer (auth, fetch construction, AI gateway non-OK, etc.). Refactoring that is a separate item.
- No frontend changes; the new `code` values are additive and the existing UI's generic error fallback continues to work until a follow-up wires the codes into UX.

### Verification
- `grep -c "errorReason\|MALFORMED_RESPONSE\|LOW_CONFIDENCE" supabase/functions/parse-travel-story/index.ts` ≥ 3.
- File still compiles (Deno types) and the surrounding archetype-resolution + 226 success return are untouched.
- Manual: feed a story that produces non-JSON output → expect 422 + `MALFORMED_RESPONSE`; happy path unchanged.