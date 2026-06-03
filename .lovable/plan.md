# Close the overlap-discard gap in must-do coverage

## Problem

In `supabase/functions/_shared/assert-must-do-coverage.ts` (line 410), a must-do venue is reported missing whenever `viable` is null — even if `anyHit` found a real card on a day. The viability check (`isVenueViableOnDay`, line 334) demotes a hit when ≥50% of its duration AND ≥20 min overlaps another non-transit activity on the same day.

Consequence: a correctly scheduled must-do (e.g. Ichiran Ramen 12:30–13:40) that happens to sit next to an overlapping lunch card is reported missing → `itinerary_status='partial'` → "Partial" badge — even though the card is in the itinerary and visible to the user. This is exactly the residual risk the user flagged.

## Fix

Treat overlap as a soft signal, not a hard demotion, for coverage accounting.

1. **`assertMustDoCoverage` (line 410)**: when `viable` is null but `anyHit` is set, accept `anyHit` as scheduled. Push to `scheduled`, record `matchedActivityIds[venue]`, and emit a structured telemetry log `[MUST_DO_OVERLAP_ACCEPTED] venue=… day=… title=… mode=exact|fuzzy` so we can still surface the scheduling conflict elsewhere (TripHealthPanel already detects activity overlaps independently).
2. **Keep `isVenueViableOnDay` intact** — it still prioritizes a viable hit over an overlapping one in the inner loop (preferring a clean card when both exist across multiple days).
3. **Inject-missing-must-dos parity check**: confirm `inject-missing-must-dos.ts` does not separately re-flag an accepted-but-overlapping venue (read-only audit; only change if it does).

## Tests

Extend `supabase/functions/_shared/__tests__/assert-must-do-coverage.fuzzy.test.ts` (or a new sibling file):

- Exact match present but overlapping → `scheduled` contains venue, `missing` empty.
- Fuzzy match present but overlapping → same outcome with `mode=fuzzy` log.
- Two days, one viable and one overlapping → viable still preferred (existing behavior preserved).
- No hits at all → still reported missing (no regression).

## Out of scope

- Frontend changes (Partial badge logic in `TripDetail.tsx` is already correct).
- Backfill of existing trips like the Tokyo one — user already confirmed regeneration is the verification path.
- Changes to overlap detection in `TripHealthPanel` (it correctly surfaces overlapping cards as a separate warning).

## Files

- `supabase/functions/_shared/assert-must-do-coverage.ts` — single accept-anyHit branch + log.
- `supabase/functions/_shared/__tests__/assert-must-do-coverage.fuzzy.test.ts` — 4 new cases.
- `mem/constraints/itinerary/must-do-coverage-injection.md` — note overlap-acceptance rule.
- `mem/index.md` — one-line update to the Must-Do Coverage core entry.
