## Fix 1.3 — Block share-enable on empty itineraries (RPC-side)

### Goal
Refuse to flip `share_enabled = true` when the trip has no itinerary, so callers never receive a token for a not-yet-generated trip and the public share page never has to handle a half-built payload.

### Approach
Take the recommended single-round-trip path: gate inside `toggle_consumer_trip_share`. No client-side fetch, no new return shape — existing `{success: false, reason: ...}` contract is reused with a new `reason: 'itinerary_not_ready'`, which `getPublicShareErrorMessage` already maps to "Generate your itinerary first to share it." (added in Fix 1.2). Callers in `TripShareModal.tsx` and `TripRecap.tsx` already toast `getPublicShareErrorMessage(result.reason)` on failure, so the message surfaces automatically.

### Changes

**1. New migration: redefine `public.toggle_consumer_trip_share`**
After the owner check, add a readiness gate that runs only when `p_enabled = true`:

```sql
IF p_enabled IS TRUE THEN
  IF v_trip.itinerary_data IS NULL
     OR v_trip.itinerary_data->'days' IS NULL
     OR jsonb_array_length(COALESCE(v_trip.itinerary_data->'days', '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'itinerary_not_ready');
  END IF;
END IF;
```

- Disabling sharing (`p_enabled = false`) is unaffected — owners can always pause.
- Token generation logic, UPDATE, and success payload are unchanged.
- Re-grant `EXECUTE … TO authenticated` (idempotent).

**2. No client changes required**
- `getOrCreatePublicTripShareLink` already returns `{success: false, reason: result.reason}` when the RPC fails (`publicShareLink.ts:92-97`).
- `TripShareModal.tsx:168/176/199` and `TripRecap.tsx:117/410` already pipe `result.reason` through `getPublicShareErrorMessage`, which renders "Generate your itinerary first to share it." for `itinerary_not_ready`.
- Existing optimistic UI (`TripShareModal` toggle switch) will revert on the failure toast — same path as `not_owner` / `trip_not_found` today.

### Out of scope
- The cheaper-but-rejected client-side fetch alternative.
- Any change to the success payload shape, token rotation, or the disable path.
- A "share will become available once generation finishes" auto-enable flow — pause-only behaviour matches existing UX.

### Validation
- Manual: on a brand-new trip with empty `itinerary_data`, click Share → toggle stays off, toast says "Generate your itinerary first to share it.", DB row keeps `share_enabled = false`.
- Manual: on a fully generated trip, Share works as before; disabling still succeeds when itinerary is empty (e.g. user wiped days then disabled).
- DB: `pg_proc` confirms `authenticated` retains EXECUTE; `anon` is intentionally not granted (toggle is owner-only).
