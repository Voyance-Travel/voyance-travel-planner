## What's happening

Trip Health surfaces three real overlaps:

- Day 1: Breakfast 08:30–09:15 vs **Transfer to Marriott** 09:00–09:45
- Day 2: Vatican 09:30–12:30 vs **Walk to Lunch via Ponte Sant'Angelo** 12:20–12:40
- Day 3: Villa Medici 10:05–10:55 vs **Walk to Hotel Flora** 10:45–11:00

In every case the **transit card starts before the previous activity ends**. We already have a deterministic fixer (`enforceTimingAndBuffers` in `supabase/functions/_shared/timing-cascade.ts`) that handles exactly this, and it runs in:

- `action-save-itinerary.ts` STEP 2.9
- `pipeline/repair-day.ts` final pass

But it only runs at *write* time. Two paths bypass it:

1. **Legacy data** — itineraries saved before the cascade was wired (and any saves done by older write paths) still carry the original overlaps. They never get re-cleaned because nothing re-runs the cascade unless the user edits.
2. **Render-time synthetic cards** — `EditorialItinerary.tsx` injects "Transfer to Marriott" / hotel arrival cards client-side after load (lines ~1623–1730 and ~1853–2010). Those cards' times are fixed from flight/hotel metadata and never reconciled against neighboring AI activities, which is exactly the Day 1 case.

The Health panel correctly flags all three, and the existing "Fix timing" button works — but that requires the user to click it on every day, on every trip. For a $20 paid product the user is right: the itinerary should arrive clean.

## Plan

Make the timing cascade run automatically without the user clicking anything, in two places, and tighten one rule that was letting transit cards slip through.

### 1. Auto-repair on itinerary load (one shot per trip, persisted)

Add a load-time pass in `EditorialItinerary.tsx` that:

- Runs **after** all synthetic injection (transit, hotel, departure cards) is finished — i.e. on the same `displayDays` derived value that Health analyzes.
- For each day, calls a tiny client mirror of `enforceTimingAndBuffers` (new file `src/utils/itinerary/timingCascade.ts`, ported from the Deno shared module — pure TS, no Deno imports).
- If any repairs are produced for any day, applies them to the in-memory `days` and triggers exactly one save through the existing `itineraryAPI` save path (which already runs the server cascade as a belt-and-suspenders).
- Idempotent: once a day round-trips clean, the next load produces zero repairs and skips the save. Guarded by a `useRef` so it can't re-fire in the same session.

Net effect: legacy trips silently heal on first open; new trips are unaffected because they're already clean.

### 2. Cover the synthetic-card path explicitly

Inside the `displayDays` builder in `EditorialItinerary.tsx`, after the transition / departure / arrival-transfer injection blocks finish for a day, run the same cascade on that day's activities **before** returning. This catches the "Transfer to Marriott @ 09:00 collides with Breakfast ending 09:15" class of conflict at the source instead of waiting for the load-time pass to notice.

We already use `cascadeFixOverlaps` from `injectHotelActivities.ts` in some sibling paths, but it only resolves overlaps by pushing forward — it doesn't enforce the buffer / same-start rules `enforceTimingAndBuffers` does. Replace those call sites with the new shared client cascade so all injection paths converge on one rulebook.

### 3. Tighten the cascade for transit cards

In `supabase/functions/_shared/timing-cascade.ts` the `isStructural` guard exempts hotel/departure cards from being moved, which is correct. But transit cards (`category: 'transit' | 'transport' | 'transfer'`) currently get a buffer of **0** between themselves and their neighbours (`getMinBufferMinutes` returns 0 when either side is transit). That's why "Walk to Lunch 12:20–12:40" is allowed to start before Vatican's 12:30 end — the cascade only acts on a true overlap, and once we resolve it, a 0-min buffer is acceptable.

Change: when *one side is a transit card and the other is not*, still allow a 0-min buffer between them, but require that the transit card's `startTime >= previous activity's endTime`. This is already what the overlap branch does, so the real fix is to ensure the transit card itself is repositioned (not just its successor) when it starts mid-previous-activity.

Mirror the same change in `src/utils/itinerary/timingCascade.ts` so client and server agree.

### 4. Tests

- Extend `supabase/functions/_shared/timing-cascade.test.ts` with the three exact scenarios above (Marriott transfer, Walk-to-Lunch, Walk-to-Hotel) — assert each transit card's start is pushed to ≥ previous end.
- Add a vitest for the new `src/utils/itinerary/timingCascade.ts` covering the same three cases.
- Add a render test (or unit test of the `displayDays` builder helper if extractable) confirming that injecting "Transfer to Marriott @ 09:00" against a Breakfast ending 09:15 results in a transfer at 09:15+.

## Files touched

- `src/utils/itinerary/timingCascade.ts` *(new — port of the Deno shared module)*
- `src/utils/itinerary/__tests__/timingCascade.test.ts` *(new)*
- `src/components/itinerary/EditorialItinerary.tsx` — load-time auto-repair effect + post-injection cascade in `displayDays`
- `src/utils/injectHotelActivities.ts` — route through the new shared cascade
- `supabase/functions/_shared/timing-cascade.ts` — transit-card start-time rule
- `supabase/functions/_shared/timing-cascade.test.ts` — new scenarios

## Out of scope

- Backfilling the entire DB. The on-load auto-repair handles trips as they're opened, which is enough for paid-user perception. A scheduled batch job is a separate ask.
- Changing how synthetic cards pick their initial time (e.g., teaching "Transfer to Marriott" to read the previous activity's end). The cascade handles it after the fact; rewriting the picker is a bigger refactor.
