---
name: Checkout Backward-Anchor Enforcement
description: Last-day hotel checkout is a hard backward anchor — preceding activities MUST end ≥15 min before checkoutStart; Executioner trims/drops overlaps deterministically.
type: constraint
---

# Checkout Backward-Anchor (Last Day)

## Rule

On the last day, the hotel checkout time is a **hard backward anchor**. Every non-checkout, non-bookend, non-locked activity scheduled BEFORE checkout MUST satisfy:

```
endTime ≤ checkoutStart − 15 minutes
```

The 15-minute floor is the minimum travel-back-to-hotel buffer. Overlapping checkout (e.g., church 10:05–11:05 over a 11:00 checkout) is a defect.

## Three Layers

1. **Prompt** — `pipeline/compile-day-schema.ts` adds a `HARD: …` line in each of the 4 last-day branches (midday flight, afternoon flight, evening flight, no-flight-data) that emits a `checkout(Time|Start|End)` value.

2. **Executioner** — `_shared/schedule-executioner.ts::enforceCheckoutAnchor` (wired in `runScheduleExecutioner` right after `enforceFlightAnchors`):
   - Finds checkout via category=accommodation+`/check[\s-]?out/i`, or `subcategory='checkout'`, or `role='checkout'`.
   - `cutoff = checkoutStart − 15`.
   - For each pre-checkout non-bookend non-locked activity with `endTime > cutoff`:
     - `startTime ≥ cutoff` → drop (post-checkout window already covers that slot).
     - `startTime < cutoff` AND `cutoff − startTime ≥ 30` → clamp `endTime := cutoff`.
     - Else → drop (would leave <30 min).
   - Locked / user / manual / extracted / pinned / booked rows: emit issue with `repaired:false`, never mutate.
   - Bookend-source rows (`source: 'bookend-*' | 'late_nightlife_bookend'`) exempt.
   - Counter: `checkoutOverlapsTrimmed`. Audit code: `EXEC_CHECKOUT_OVERLAP_TRIMMED`.

3. **Validator** — `pipeline/validate-day.ts::checkCheckoutOverlap` (last day only). Emits `FAILURE_CODES.CHECKOUT_OVERLAP` with `severity:'warning'` for read-time auditor parity / legacy-trip surfacing. Repair is the Executioner's job; the validator never blocks.

## Sentinels

- `[EXECUTIONER] CHECKOUT_OVERLAP_TRIMMED day=N {clamped|dropped} title="…" …`
- `metadata.quality.executioner.checkoutOverlapsTrimmed` counter
- `metadata.quality.executioner_audit[].code = 'EXEC_CHECKOUT_OVERLAP_TRIMMED'`

## Tests

`supabase/functions/_shared/__tests__/checkout-anchor-enforcement.test.ts` — 7 cases (clamp, post-checkout preserve, drop-too-short, drop-inside-buffer, locked-preserve, non-last-day no-op, bookend exempt).

## Out of Scope

- Per-hotel travel-time estimate (would require Google Distance Matrix on every last-day repair) — fixed 15-min buffer for now.
- Gap-refill after trim — the existing Executioner `runExecutionerRefill` already covers ≥90-min gaps left by any prior drop.
