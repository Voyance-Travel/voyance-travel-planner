## Scope

Ship M3, M4, M5 as previously planned, with three small addenda from the user's approval notes.

---

## M3 — Health engine overnight gap leak

**Files:** `src/components/trip/TripHealthPanel.tsx` (+ test)

Fixes (as previously planned):
1. `parseItineraryDays` / day-array builder: drop wrap-past-midnight bookends from the *next* day's bucket.
2. `realActivities` filter: also exclude `transit | return | logistics | hotel_return | bookend` categories.
3. Per-day gap detector unchanged (already correct at line 66).
4. Hotel-return detection uses brand-aware regex already in `clamp-bookend.ts::isBookendCard` — reuse, don't duplicate.
5. **Bonus catch — ship it:** buffer/conflict passes currently iterate the unfiltered activities array. Swap them to `realActivities` so phantom overlap warnings stop firing on the same wrap-past-midnight pattern.

Addendum from user:
- **Wrap-detection edge case:** current proposal `endTime > 0 && endTime < startTime` would false-negative a `Return to Hotel` ending at exactly `00:00`. Change predicate to treat `endTime <= 0` (or explicit `endTime === 0 && startTime > 0`) as wrap. Add unit test: bookend `23:30 → 00:00` must be classified as wrap and excluded from the next day's bucket.

Sentinel/log: keep existing `[BOOKEND_CLAMP]` + add a one-line `[HEALTH_GAP] day=N excluded=K (wrap+logistics)` debug.

---

## M4 — Walk-over-threshold leaks

**Files:** `supabase/functions/_shared/sanitization.ts`, `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§15b), `_shared/transit-mode.ts` (helper reuse) (+ tests)

Fixes (as previously planned):
1. **Title-only walk cards:** sanitizer's method gate currently keys off `transport_mode` field — extend to also classify when title matches `^walk|stroll\b` AND no explicit non-walk mode is set. Routes title-only "Walk to X" through the threshold cascade.
2. **Sanitizer no-op when one endpoint coord missing:** fall back to surrounding-card coords (prev.end → next.start) via existing `extractCoords`; only skip when *both* sides are unknowable.
3. **Repair §15b haversine fallback:** when leg has no precomputed distance, derive it from surrounding coords using existing `extractCoords` + `haversineMeters`. No new utilities.

Addendum from user:
- **Defer luxury sub-cap.** Keep canonical 30 min / 1500 m thresholds. After ship, run a 2–3 city QA pass (Madrid + 2 others) to confirm the leak fix alone resolves the cross-district walk pattern. Only revisit luxury sub-cap if the pattern recurs.

Tests: 3 regression cases — title-only walk, missing-endpoint-coord, repair-fallback haversine. Plus a luxury-tier in-neighborhood walk (~600m, ~10 min) that must remain a walk to confirm we did *not* over-tighten.

---

## M5 — Paid-tour price floor

**Files:** `supabase/functions/generate-itinerary/_shared/category-price-bounds.ts`, `pipeline/repair-day.ts` (price-substitute step), `action-repair-costs.ts` (mirror) (+ test)

Fixes (as previously planned):
1. Extend existing `CATEGORY_PRICE_CEILINGS` with `min > 0` for paid-only subcategories: `bike_tour`, `food_tour`, `cooking_class`, `wine_tasting`, `boat_tour`.
2. Detection regex order: paid-tour regexes run **before** existing `WALKING_TOUR_RE` so "bike tour" doesn't fall through to `walking_tour` (`min: 0`).
3. Keep `museum` and `walking_tour` at `min: 0` (free variants are real).
4. Universal Locking: user-locked / `basis=user` rows skipped — included as an explicit test case.

Addendum from user:
- **Inverse-direction regression test:** $300 luxury private bike tour (e.g. Salamanca private guide) must NOT trigger `PRICE_IMPLAUSIBLE`. Audit current `bike_tour.max`: if it's $90, bump to **$150** to accommodate legitimate luxury private variants. Same review pass for `food_tour` / `wine_tasting` / `cooking_class` / `boat_tour` max ceilings — bump where the upper end of legitimate luxury would otherwise be flagged. Document chosen ceilings in the file's header comment.

Sentinels: existing `[REPAIR_PRICE_SUBSTITUTE] direction=floor_raise|ceiling_cap` cover both directions.

---

## Out of scope

- M4 luxury sub-cap (deferred pending QA).
- Remaining 17-item queue verification, Q43 watch-list source reads, and post-ship linter rerun — separate batches as results arrive.
- No changes to Universal Locking, cost reference table, or budget snapshot logic.

## Verification

- Vitest: new cases for M3 (wrap at exactly 00:00 + logistics filter), M4 (3 leak paths + luxury-walk negative), M5 (paid-tour floor + locked-$0 preserved + luxury-priced upper bound).
- Manual: regenerate one Madrid + one Barcelona trip; confirm no phantom gap warnings, no >1.5km walks on luxury Day 1, no $0/Free paid-tour cards, no $300 private bike tour flagged.
