## Auto-include joining traveler in already-generated trips

**Problem.** When user B accepts an invite to a trip that has already been generated, `accept_trip_invite` adds them to `trip_collaborators` but the itinerary stays unchanged. Today only the manual `BlendRecalcBanner` (which the owner has to notice and click) ever picks up the new DNA. The joiner sees no reflection of their preferences and support gets confused tickets.

**Goal.** After a successful `accept_trip_invite` against a trip whose `itinerary_status = 'ready'`, automatically recompute the blended DNA and regenerate the itinerary, showing the joiner a clear "blending you in…" status while it runs.

### Constraint check (why we can't ship the literal snippet)

The proposed call `supabase.functions.invoke('generate-itinerary', { body: { action: 'regenerate-trip-with-blend', includeNewTraveler: userId } })` cannot work as written:

1. **Action does not exist.** `generate-itinerary` only dispatches `generate-full | generate-trip | generate-day | regenerate-day | generate-trip-day | get-trip | save-itinerary | get-itinerary | toggle-activity-lock | sync-itinerary-tables | repair-trip-costs`.
2. **Proof-of-charge gate** in `generate-itinerary/index.ts` (lines 200–257) blocks any regeneration unless a `pending_credit_charges` row exists for `(user_id, trip_id, action)` in the last 10 minutes. The joiner is not the trip owner and has no charge — request will 403 with `GENERATION_NOT_AUTHORIZED`.
3. **Field name.** The trip-level status column is `trips.itinerary_status` (enum: `not_started|queued|generating|partial|ready|failed`), not `trips.generation_status`. `generation_status` lives on `trip_cities` per leg.
4. **Rate-limit rule** for default actions is 20/min/user — fine for a single accept, but accept-loops on a flaky network could trip it.

We'll therefore add a small dedicated **service-trusted edge function** that performs the regen on the joiner's behalf, then call it from `AcceptInvite.tsx`.

### Implementation

**1. New edge function `supabase/functions/regenerate-on-blend-change/index.ts`**

Responsibilities:
- Validate caller's JWT and resolve `userId`.
- Validate request body with Zod: `{ tripId: string (uuid) }`.
- Verify the caller is either the trip owner OR an accepted row in `trip_collaborators` for that trip (RLS-safe service-role read with explicit ownership check). Reject otherwise.
- Read the trip; abort early if `itinerary_status !== 'ready'` (no point regenerating a trip mid-generation or unbuilt). Return `{ skipped: true, reason }`.
- **Recompute `blended_dna`** server-side: load all accepted collaborators with `include_preferences=true` + the owner, fetch their `travel_dna` rows, run the same shared blending logic that `action-generate-trip.ts` uses (lines around 350–360 + `pipeline/compile-prompt.ts` 1061). Update `trips.blended_dna` and `trips.blended_dna_snapshot` so `BlendRecalcBanner` will hide on next render.
- **Insert a system-attributed `pending_credit_charges` row** (action `regenerate_blend_join`, status `completed`, amount `0`, owner_user_id = trip owner) so the proof-of-charge gate downstream is satisfied without billing the joiner. Cost policy mirrors the existing "system action" pattern used by other internal flows.
- **Chain to `handleGenerateTrip`** (the multi-day regen entry point already used by `action-generate-trip.ts`): either invoke directly via internal function call, or `supabase.functions.invoke('generate-itinerary', { body: { action: 'generate-trip', tripId, mode: 'regenerate' }, headers: { Authorization: 'Bearer <SERVICE_ROLE_KEY>' } })` so it bypasses the user-facing gates (the dispatcher already accepts a service-role bearer, see `index.ts` lines 103–120).
- Set `itinerary_status` back to `generating` immediately on entry so the UI shows the right state, and let `handleGenerateTrip` flip it to `ready` on completion.
- Return `{ ok: true, queued: true }`. The actual generation runs to completion in the background like every other regen; we don't block the HTTP response on it.

CORS + JWT validation per project conventions; `verify_jwt = false` is fine because we validate manually.

**2. `src/pages/AcceptInvite.tsx` — handler change (around line 269–277)**

Replace the success branch with:

```ts
if (result?.success) {
  clearPendingInviteToken();
  setAccepted(true);

  // Check if this trip is already generated and needs a blend refresh
  if (!result.alreadyMember && result.tripId) {
    const { data: tripRow } = await supabase
      .from('trips')
      .select('itinerary_status')
      .eq('id', result.tripId)
      .maybeSingle();

    if (tripRow?.itinerary_status === 'ready') {
      toast.success("You've joined the trip! Blending in your preferences…", { duration: 5000 });
      // Fire-and-forget: server returns immediately and runs regen in background
      supabase.functions
        .invoke('regenerate-on-blend-change', { body: { tripId: result.tripId } })
        .catch(err => logger.error('[invite] blend regen invoke failed', err));
    } else {
      toast.success("You've joined the trip!");
    }
  } else {
    toast.success(result.alreadyMember ? "You're already a member!" : "You've joined the trip!");
  }

  setTimeout(() => navigate(`/trip/${result.tripId}`), 1500);
}
```

When the user lands on `/trip/:id`, the trip's `itinerary_status` will be `generating` and the existing generation-progress UI already covers the in-flight state. `BlendRecalcBanner` resolves itself once `blended_dna_snapshot` matches the new collaborator set.

**3. Idempotency / race protection**

- `regenerate-on-blend-change` short-circuits if `itinerary_status === 'generating'` (returns `{ skipped: true, reason: 'in_progress' }`). Two simultaneous joins can't double-trigger.
- If the joiner closes the tab before the invoke flushes, `BlendRecalcBanner` is the safety net — owner sees the prompt next time they open the trip.

### Verification

1. Owner A (Cultural Anthropologist) generates a 4-day Rome trip. Confirm `itinerary_status='ready'`, `blended_dna.isBlended=false`.
2. Invite user B (Adrenaline Architect). B accepts.
3. Toast: *"Blending in your preferences…"*. AcceptInvite navigates to `/trip/:id` with `itinerary_status='generating'` and progress UI visible.
4. After regen completes, inspect `trips.blended_dna` — `travelerProfiles` array contains both users, weights 0.5/0.5 (matches the even-split rule shipped earlier). At least 1–2 days should pivot toward adventure activities (climbing wall, food-tour with cycling, etc.).
5. Invite user C and accept — toast appears, regen runs again, weights are 0.33 each.
6. Re-accept (e.g. via stale invite link) returns `alreadyMember: true` with no regen — confirm no second invoke fires.
7. Force `itinerary_status='generating'` manually, then accept → server returns `{skipped:true}`; client toast falls back to plain "You've joined".

### Files touched

- **New:** `supabase/functions/regenerate-on-blend-change/index.ts`
- **Edited:** `src/pages/AcceptInvite.tsx` (success branch only)
- **No DB migration required** — `pending_credit_charges` already supports system rows; reuses existing columns.
- No changes to `accept_trip_invite` RPC, no changes to `generate-itinerary` dispatcher beyond the existing service-role bypass.
