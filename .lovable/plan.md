## Root cause (different from last time)

Last fix handled: real venue + stale generic title like "Spa Time" → rewrite at render. Today's case is upstream of that.

The literal string `"Spa Time — find a venue"` is **written by the server** at `supabase/functions/generate-itinerary/pipeline/repair-day.ts:665` in the "stripped" branch of the wellness placeholder repair. That branch fires when:

1. The destination city isn't in the curated `INLINE_FALLBACK_WELLNESS` list (Bali, Tokyo, NYC, etc. — anywhere outside Paris/Rome/Berlin/Barcelona/London/Lisbon), AND
2. There's no `hotelName` to downgrade to.

The branch (lines 662–678) overwrites `act.title` and `act.name` with the placeholder string but **leaves `act.location.name` untouched**. So the AI-supplied venue ("Kami Spa", with address, possibly placeId) survives in the data, while the title says "find a venue". That's the label bleed.

The previous client rewrite (`activityNameSanitizer`) only catches *generic-pattern* titles ("Spa Time", "Wellness Refresh"). It does **not** match the literal `"Spa Time — find a venue"` string, so it can't repair this case at render time either.

## Plan

Two coordinated fixes — server stops creating the bad title when a real venue exists; client cleans up legacy data already saved with it.

### 1. Server: don't strip when a real venue is already present

In `supabase/functions/generate-itinerary/pipeline/repair-day.ts` around line 661 (the "no fallback DB and no hotel" branch), before falling through to the placeholder-string strip, check whether the activity *already has a real-looking venue*:

```ts
const existingVenue = (act.location?.name || act.venue_name || '').trim();
const existingAddr  = String(act.location?.address || '').trim();
const hasRealVenue =
  existingVenue.length >= 4 &&
  !/^(your hotel|the spa|the wellness|hotel spa)$/i.test(existingVenue) &&
  (existingAddr.length >= 8 ||
   !!act?.metadata?.google_place_id ||
   !!act?.metadata?.placeId);

if (hasRealVenue) {
  const before = act.title;
  act.title = `Spa Session at ${existingVenue}`;
  act.name = act.title;
  // cost stays $0 per Wellness Venue Integrity (unverified by our DB)
  act.cost_per_person = 0;
  if (act.cost) act.cost.amount = 0;
  (act as any).metadata = { ...(act as any).metadata, unverified_venue: true };
  act.source = 'wellness-placeholder-keep-venue';
  repairs.push({
    code: FAILURE_CODES.GENERIC_VENUE,
    activityIndex: vr.activityIndex,
    action: 'kept_ai_venue_rewrote_title',
    before,
    after: act.title,
  });
  continue;
}
// ...existing strip path below
```

Why $0: Core memory says wellness without a curated/placeId-verified venue must snapshot $0 — we trust the venue name enough to surface it, not enough to charge for it.

### 2. Client: rescue legacy data already saved with the placeholder string

In `src/utils/activityNameSanitizer.ts`, in the wellness branch (around lines 211–224 from last edit), add a check for the exact placeholder string in the *raw input* — if the activity has a real venue alongside it, rewrite to "Spa Session at {venue}" instead of preserving the placeholder:

```ts
// Legacy: server wrote "Spa Time — find a venue" but kept a real venue on
// location.name. Rescue by rewriting from the venue.
if (sanitized === WELLNESS_PLACEHOLDER_FALLBACK || /find a venue$/i.test(sanitized)) {
  const venue = (probe.location?.name || probe.venue_name || '').trim();
  if (venue && venue.length >= 4 && !/^(your hotel|the spa|hotel spa)$/i.test(venue)) {
    return `Spa Session at ${venue}`;
  }
}
```

Place this *before* the existing `isClientPlaceholderWellness` block so it short-circuits.

### 3. Tests

- `supabase/functions/generate-itinerary/pipeline/repair-day.test.ts` (or nearest existing test file): new case — wellness activity with `title: "Wellness Moment"`, `location: { name: "Kami Spa", address: "Jl. Petitenget 123" }`, no fallback DB, no hotelName → after repair, title is `"Spa Session at Kami Spa"`, cost is `$0`, `metadata.unverified_venue === true`.
- `src/utils/__tests__/wellnessPlaceholderDetection.test.ts`: new case — input title `"Spa Time — find a venue"` + venue `"Kami Spa"` + numeric address → `sanitizeActivityName` returns `"Spa Session at Kami Spa"`. Regression: same input with empty venue → returns the placeholder unchanged.

## Out of scope

- Adding more cities to `INLINE_FALLBACK_WELLNESS` (separate content task).
- Backfilling stored titles in DB; the client rescue handles render and the next save persists the fix.
- Changing the cost policy for AI-supplied wellness venues (stays $0).

## Files touched

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — keep AI venue branch before the strip
- `src/utils/activityNameSanitizer.ts` — render-time rescue of literal placeholder string
- Tests in both layers
