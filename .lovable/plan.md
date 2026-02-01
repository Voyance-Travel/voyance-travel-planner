
## What’s actually broken (root cause)

Your “Single Source of Truth” data resolution in `profile-loader.ts` looks correct now (it successfully resolves `primary_archetype_name` from `travel_dna_profiles`, and your DB row confirms `flexible_wanderer` is present).

The remaining failure is in the **day-by-day generation path**:

- Frontend calls `generate-day` / `regenerate-day` **without `userId`** (it sends `tripId`, `dayNumber`, etc.).
- Backend `generate-itinerary/index.ts` currently does:

  - `generate-day` destructures `userId` from the request body:
    - `const { ..., userId, ... } = params;`
  - Then uses that `userId` for:
    - `getUserPreferences(...)`
    - `getLearnedPreferences(...)`
    - `loadTravelerProfile(...)`

So on `generate-day`, `userId` is **undefined**, and the backend silently falls back to “no Travel DNA / no prefs” behavior — which looks exactly like “customization not working”.

This explains why the “full trip” pipeline might look somewhat personalized (it often passes `userId`), but **regenerating or generating individual days does not**.

## Goal

Make all generation paths (full + day) use the authenticated user from the request’s auth token, not an optional `userId` field in the JSON body.

This fixes:
- missing personalization on `generate-day`
- and also hardens security (prevents spoofing `userId` in the request body)

---

## Implementation plan (code changes)

### 1) Update `generate-itinerary` to use authenticated user ID everywhere
**File:** `supabase/functions/generate-itinerary/index.ts`

**Change:**
- After `validateAuth(req, authClient)` succeeds, define a single source of truth:
  - `const authedUserId = authResult.userId;`

Then in **every action handler**, use:
- `const userId = authedUserId;`

And stop relying on `params.userId` for anything security-sensitive or personalization-related.

#### Specifically fix `generate-day` / `regenerate-day`
Current handler destructures `userId` from params:
- `const { ..., userId, ... } = params;`

Plan:
- Remove `userId` from that destructuring.
- Set `const userId = authedUserId;`
- Ensure the calls use that:
  - `getUserPreferences(supabase, userId)`
  - `getLearnedPreferences(supabase, userId)`
  - `loadTravelerProfile(supabase, userId, tripId, destination)`

This is the direct fix for the “customization not working” symptom.

#### Also fix `generate-full`
Even though frontend often passes `trip.userId`, we should still ignore it in backend for correctness and safety:
- `const { tripId, tripData } = params;`
- `const userId = authedUserId;`
- Pass `userId` into `prepareContext(...)`, preference loading, and `loadTravelerProfile(...)`.

### 2) Add a mismatch guard (optional but recommended)
If the request body *does* include a `userId` and it’s different from `authedUserId`, return 403 and log it.

Why:
- Prevents user spoofing attempts.
- Helps catch accidental frontend bugs.

### 3) Add explicit trip access enforcement for generation actions (recommended)
Right now `generate-full` and `generate-day` don’t appear to enforce “owner/collaborator” access the same way some other actions do in the same file.

Plan:
- Before running any AI generation, verify:
  - user is the trip owner OR
  - user is an accepted collaborator with edit permissions (for generation actions that write itinerary)

Implement as a small helper function (in the same file) reused by both actions:
- Query `trips` for `user_id`
- Query `trip_collaborators` for accepted collaborator and permission
- If unauthorized: return `403 { error: "Trip not found or access denied" }`

This improves security and also guarantees we always have a canonical trip owner available (useful for auditing/logging).

### 4) Add/adjust debug logs to confirm correct profile resolution
Add a single log line in `generate-day` after calling `loadTravelerProfile`:
- archetype
- source
- isFallback
- completeness

This lets us confirm instantly from backend logs that day-regeneration is now using the same profile as full-generation.

---

## How we’ll verify (end-to-end)

### A) UI verification (most important)
1. Generate a full itinerary for a trip (your normal flow).
2. Regenerate a single day (or generate day-by-day).
3. Confirm the regenerated day keeps the correct persona style (e.g., Flexible Wanderer: loose pacing, exploration language, no “luxury tour” tone).

### B) Backend log verification
Check backend function logs for lines like:
- `[generate-itinerary] Authenticated user: <id>`
- `[profile-loader] ✓ Resolved archetype: flexible_wanderer (source: canonical)`
- In `generate-day`: the same archetype + non-fallback profile

### C) Negative test (security)
Attempt to call generation with a mismatched `userId` in the request body (if feasible).
- Expect: `403`

---

## Files that will change

- `supabase/functions/generate-itinerary/index.ts`
  - Replace use of `params.userId` with `authResult.userId` in:
    - `generate-day` / `regenerate-day`
    - `generate-full`
  - Add optional userId mismatch guard
  - Add trip access enforcement helper and apply it to generation actions

---

## Expected outcome

- Day generation/regeneration now uses the same unified traveler profile as full generation.
- Customization (archetype identity, traits, avoid list, interests, dietary rules) applies consistently across:
  - full itinerary generation
  - single-day regeneration
- Reduced risk of cross-user trip access or userId spoofing.

