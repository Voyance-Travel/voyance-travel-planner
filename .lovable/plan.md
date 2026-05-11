# R5 — `parse-*` auth gate: already shipped, no changes needed

## Findings

The repo has four `parse-*` edge functions; the requested pattern is already in place on all of them via the shared helper `supabase/functions/_shared/require-auth.ts`.

| Function | OPTIONS handler | `requireAuth(req)` | `trackCost` |
|---|---|---|---|
| `parse-booking-confirmation` | line 112 | line 116 | line 302 (Gemini 3 Flash) |
| `parse-document-text` | line 12 | line 16 | n/a (no AI call — does local PDF text scrape) |
| `parse-travel-story` | line 70 | line 74 | line 179 (Gemini 2.5 Flash) |
| `parse-trip-input` | line 360 | line 364 | line 440 (Gemini 3 Flash) |

`requireAuth`:
1. Rejects requests without `Bearer` header → `401 { error: "Authentication required", code: "UNAUTHORIZED" }`.
2. Validates the bearer via `supabase.auth.getClaims(token)` → `401 { error: "Invalid token", code: "AUTH_INVALID" }` on failure.
3. Returns CORS-headered JSON in both error cases.

This matches the requested PROMPT R5 spec verbatim, just centralised in a shared module instead of inlined in each function — which is the project's documented pattern (the helper's docstring even calls this out: *"so any future change happens in one place"*).

There is no `parse-document` (without `-text`) or `parse-itinerary` function — only the four above. The user prompt's filename list (`parse-document` / `parse-booking-confirmation` / `parse-itinerary`) was approximate; the equivalent shipped functions are covered.

## Plan

**No code changes required.** Verify in this turn:

1. `curl -X POST https://<project>.functions.supabase.co/parse-document-text` (no auth) → expect `401 {"error":"Authentication required","code":"UNAUTHORIZED"}`.
2. Same with a valid Bearer → expect `200` (or domain-specific `400` for missing file, which is downstream of auth).
3. Repeat for `parse-booking-confirmation`, `parse-travel-story`, `parse-trip-input`.
4. Run `supabase--linter` and confirm no `parse-*` function is flagged for missing JWT verification.

If any check fails, fall back to:
- Spot-fix the affected function to ensure the `requireAuth` call sits immediately after the OPTIONS handler with no early bailouts in between.
- Confirm `verify_jwt` handling in `supabase/config.toml` matches the project's signing-keys mode (no per-function override needed).

## Memory

If verification passes, no new memory entry — the existing pattern is already documented implicitly via the shared helper. If a regression is found and fixed, save a new entry `mem://constraints/security/parse-functions-require-auth` enumerating the four functions and the helper.
