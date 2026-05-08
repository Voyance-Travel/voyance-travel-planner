# Departure-Day "Thin Finish" Fix

## Symptom
Day 3 (departure): lunch ends 13:55 → checkout 14:40 → "Transfer to Airport" with no time. Two failures stacked: (a) the transfer card has no `startTime`/`endTime`, and (b) there's no graceful pre-departure beat — the day dies at checkout.

## Root Cause
1. **Transfer-time integrity gap** — `repair-day.ts` step 8b only checks if a departure-transport card *exists* by title. If the AI emitted "Transfer to Airport" without times, the guarantee skips injection, leaving an untimed card on screen.
2. **No "graceful finish" rule** — `fill-dead-gaps.ts` requires a 180-min gap to fire. A 75–180-min last-day window (lunch end → depart−buffer) falls through, and there's no prompt directive forcing the model to plan a low-key final beat (espresso, hotel terrace, short stroll, last gallery).

## Fix — Three layers

### Layer 1 — Departure transport time-integrity (repair-day.ts §8b)
Tighten the existence check at line 1898: require BOTH a valid `startTime` AND `endTime` on the matching card. If either is missing/invalid:
- Drop the broken card.
- Fall through to the existing injection path (computes time from `returnDepartureTime24 − 180min` for flights, `legDepTime − 60min` for trains, or `checkoutEnd + 15min` fallback).
- Log `repair.action='fixed_untimed_departure_transport'`.

Also extend `validate-day.ts` to flag any `category=transport|logistics` row containing `airport|station|transfer to` that's missing `startTime` or `endTime` → raise `DEPARTURE_TRANSPORT_UNTIMED`.

### Layer 2 — Graceful finish beat (new repair-day step §8c)
After §8b on departure days only, scan for the window `[lastNonLogisticsEnd … min(checkoutTime, departureTime − buffer)]`:
- If window ≥75min AND ≤120min AND no non-logistics card already fills it → insert a "Final Moments" card.
- Source: reuse `proposeGapFiller` with hint `"luxury final beat: espresso bar, hotel terrace, last gallery, short passeggiata — low intensity, near hotel"`.
- Cap duration at 90min; clamp end ≤ window end.
- Locked/manual/extracted/pinned activities are never disturbed.
- Sentinel: `repair.action='injected_graceful_finish'`.

### Layer 3 — Prompt directive (`believable-human-day.ts`)
Add to DEPARTURE DAY rules:
> "When the gap between the final meal and (departure − airport-buffer) or hotel checkout exceeds 75 minutes, plan a low-key final beat (espresso, hotel terrace/lounge, short stroll, last small gallery) — never end the day abruptly with checkout immediately after lunch. The Transfer to Airport/Station card MUST include explicit `startTime` and `endTime` derived from departure time minus the buffer (180m flight / 120m train)."

## Files to edit
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — tighten §8b, add §8c
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — `DEPARTURE_TRANSPORT_UNTIMED` rule
- `supabase/functions/generate-itinerary/believable-human-day.ts` — DEPARTURE DAY directive
- `supabase/functions/_shared/__tests__/` — unit test for untimed-card replacement + graceful-finish window math

## Memory
Add `mem://constraints/itinerary/departure-day-graceful-finish` documenting the 75–120min graceful-finish window, the time-integrity check on transfer cards, and the three sentinels.

## Out of scope
- Changing the 180m flight buffer / 120m train buffer constants.
- Modifying locked or user-edited activities.
- Frontend rendering changes (data fix only — UI already renders any present startTime/endTime).
