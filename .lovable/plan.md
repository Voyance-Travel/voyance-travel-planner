## TRIP-2 — Deterministic per-trip session anchor

### Findings

`src/services/tripSaveResumeAPI.ts` has **three** session-ID generators, not just the one the spec mentions, and they're inconsistent:

| Line | Function | Current behavior |
|------|----------|------------------|
| 152 | `saveTripProgress` | Reads `trip_session_id` from sessionStorage; falls back to `session-${Date.now()}` (does NOT write back — bug) |
| 180-181 | `resumeTrip` | Always mints a **fresh** `session-${Date.now()}` and overwrites sessionStorage every call (the actual race source) |
| 224 | `getSessionStatus` | Same read-with-fallback as save (no write-back) |

`tripId` is a required parameter on all three functions, so a deterministic `trip-${tripId}` anchor is always available. The spec's pattern fits cleanly.

### Plan

**1. Apply the spec to `saveTripProgress` (line 152)**

Replace the single line with:

```ts
// Use the trip ID as the canonical session anchor — one session per trip per
// user. Prevents the race where two concurrent saves use different session IDs
// and the server's "latest" logic gets confused.
const sessionId = tripId
  ? `trip-${tripId}`
  : sessionStorage.getItem('trip_session_id') || crypto.randomUUID();
if (!tripId) {
  sessionStorage.setItem('trip_session_id', sessionId);
}
```

**2. Apply the same anchor to `resumeTrip` (lines 180-181)**

Currently mints a fresh ID every call — this is the *primary* race the spec is fixing (save uses cached ID, resume overwrites it mid-flight). Replace with the same deterministic block so save↔resume↔status all agree:

```ts
const sessionId = tripId
  ? `trip-${tripId}`
  : sessionStorage.getItem('trip_session_id') || crypto.randomUUID();
if (!tripId) {
  sessionStorage.setItem('trip_session_id', sessionId);
}
```

**3. Apply the same anchor to `getSessionStatus` (line 224)**

Same replacement — otherwise status checks would query a different session than the one save/resume just used, defeating the fix.

### Out of scope
- Server-side session-handling logic
- Removing the `trip_session_id` sessionStorage key (kept as the no-tripId fallback per spec)
- The 4 other call sites (`createTripDraft`, `updateTripDraftSection`, etc.) — they don't send `X-Session-ID`

### Verification
- `grep -c "trip-\${tripId}" src/services/tripSaveResumeAPI.ts` → 3 (spec requires ≥1)
- All three X-Session-ID-sending functions emit `trip-<tripId>` for the same trip across save / resume / status calls
