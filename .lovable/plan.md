## Stop "pasting" floating must-dos on top of the itinerary

### What's happening on the live trip (Jeju, `82e56447…`)

You entered three free-text must-dos with no day and no time:
- Hallasan National Park
- Cheonjiyeon Waterfall
- Jeju Stone Park

At trip creation (`src/pages/Start.tsx` L2506) they were converted into **locked anchors** with `dayNumber: 0`, `source: 'single_city'`, no `startTime`, no `description`, no `location`. The `anchor-guard` then *injects* those naked locked rows back onto the days at every persistence boundary — that's why Cheonjiyeon Waterfall and Jeju Stone Park currently appear on Day 1 *and* Day 2 with no time, no address, no description, sitting on top of the real model-generated `Hallasan National Park Hike` (which does have an address + 284-char description). The previous "hardening pass" made it worse by widening that anchor-paste path, instead of fixing it.

The model **already** receives these items as a `## 🚨 USER'S RESEARCHED RESTAURANTS & VENUES (MANDATORY)` block in `compile-prompt.ts` L521 and weaves them in properly. The locked-anchor projection is the layer that corrupts the output.

### The fix (single principle)

**Free-text must-dos without an explicit `Day N` and an explicit time are SOFT requirements only — not locked anchors.** They feed the prompt, the model places them with a real title / time / address / description, and the result is what you see.

### Changes

1. **`src/pages/Start.tsx` (L2500-2521, trip creation):**
   - Build `userAnchors` only for items where `parseMustDoEntry` extracted **both** `dayNumber >= 1` AND `startTime`. Drop the rest from `metadata.userAnchors`. They still go into `metadata.mustDoActivities` (string list), which is the prompt-feeding path.
   - Same change for `selectedLandmarks` (chip picks) — landmarks were silently being locked too.

2. **`src/components/planner/ItineraryContextForm.tsx` (the form added in the hardening pass):**
   - Mirror the same gate: only entries with parsed `dayNumber >= 1` AND `startTime` become anchors / `perDayActivities`. Free-text lines stay in `mustDoActivities` string. The "We understood" chip list keeps showing all parsed items, but with a clear "soft suggestion" vs "pinned to Day N · 7:30 PM" distinction so users know what will be locked vs woven in.

3. **`supabase/functions/_shared/user-anchors.ts::buildUserAnchors`:**
   - Add an `onlyPinned: true` option (default behavior unchanged for chat path where times are extracted). Frontend creation paths pass `onlyPinned: true`.
   - Alternative: keep the function permissive and gate at call sites only. Pick whichever is cleaner during implementation — net effect must be: dayNumber:0 + no startTime entries never make it into `metadata.userAnchors`.

4. **`supabase/functions/generate-itinerary/anchor-guard.ts::distributeFloatingAnchors`:**
   - Defense in depth: if a floating anchor reaches this function with no `startTime` AND no `venueName`, skip it. Log `[ANCHOR_GUARD] floating_dropped reason=soft_must_do title=…`. This stops legacy trips and any other caller from regressing.

5. **One-shot heal for the existing trip:**
   - SQL migration that, for every trip where `metadata.userAnchors` contains entries with `dayNumber: 0 AND startTime IS NULL`, strips those entries from the array. Items remain in `metadata.mustDoActivities` so the next regenerate still respects them as soft requirements. No itinerary_data rewrite — user can hit "Refresh day" if they want the model to re-place them cleanly.

6. **`enrich-day.ts` (already widened in last pass):**
   - No further change. With the locked-naked rows gone, the only remaining anchors are *real* pinned ones (Day N + time), and the existing `anchor-enrichment-allowed` path will fill address + description on those.

### Out of scope
- No changes to the `compile-prompt.ts` MANDATORY block — it already does the right thing.
- No changes to `must-do-priorities.ts` or how the prompt ranks must-dos.
- No new UI for time-picker per item — the chip "soft / pinned" hint is enough.

### Verification on `82e56447…`
1. Run the one-shot heal migration → `metadata.userAnchors` becomes `[]` for this trip.
2. Hit "Refresh day" on Day 1 (or full regenerate) → model places Hallasan / Cheonjiyeon / Jeju Stone Park exactly once each, with `startTime`, `location.address`, and ≥30-char description; no orphan `single_city` locked rows.
3. Re-enter "Day 2: Cheonjiyeon Waterfall 2pm" via the form → that one becomes a pinned anchor (locked, time 14:00), enrichment fills address + description, and it does NOT also appear on other days.
4. Re-enter "Jeju Stone Park" with no day/time → it appears in the prompt block, model places it on whichever day fits best with full address + description, and `metadata.userAnchors` stays empty for that item.
