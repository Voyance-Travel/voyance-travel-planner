# Intelligence panels — audit & lock down

## What I found

The four collapsible panels on the Itinerary tab pull from very different sources, with very different risk profiles:

| Panel | Source | Real data? | Risk |
|---|---|---|---|
| **Voyance Intelligence** | Heuristic keyword scan over activities (`calculateItineraryValueStats`) | Counts are real, but **savings strings are fabricated** | Medium |
| **Trip Completion** | Live derivation from `days`/flights/hotel (`TripHealthPanel`) | Real | Low |
| **Travel Intelligence** | Perplexity `sonar-pro` via `generate-travel-intel`, cached in `travel_intel_cache` | Real, AI-generated | High — no payload validation, sub-fields can crash or render blanks |
| **Better Alternatives** | Lovable AI Gemini via `generate-skip-list`, sessionStorage cache + hardcoded fallback for 6 cities | Real-ish | Medium — no validation, unknown categories render as empty label |

### Specific bugs / placeholder leaks

1. **Voyance Intelligence "estimated savings" is invented.** `calculateEstimatedSavings` in `src/utils/intelligenceAnalytics.ts` multiplies counts by hardcoded constants: `timing × 25min`, `localPicks × $35`, `gems × $18`, then renders e.g. "1+ hour saved · ~$53 vs. typical itinerary". There is no actual basis. Savings claims must come from real data (the `skippedItems[].savingsEstimate` already carries them) or be removed. Same for the per-item `savingsTime: '20-30 min'` literal in `timingDetails`.

2. **Travel Intelligence renders blank/undefined sub-fields.** `TravelIntelCard.tsx` lines 405–409 directly access `intel.moneyAndSpending.mealCosts.budget/midRange/fineDining` without nullish guards. If Perplexity returns `moneyAndSpending` but omits `mealCosts`, the page crashes; if it returns `mealCosts` with empty strings, the pills render blank. Same for `gettingAround.doNotDo/bestOption/...` (line 385+) — if any field is missing from the AI response, the `TipLine` shows just an icon. The truncation-repair in the edge function is heroic but doesn't validate semantic completeness.

3. **Travel Intelligence cache key is stale-by-design.** `travel_intel_cache` keys on `trip_id` (single row, upsert with `onConflict: 'trip_id'`). Cache hit only if `destination` AND `start_date` AND `end_date` all match exactly. So if the user changes dates, the cache row is overwritten on next fetch — fine. But the cache hit also ignores `archetype`/`interests`/`hotelArea` — changing those will silently return stale intel. Refresh button works around this but users won't know to use it.

4. **Better Alternatives shows empty category labels.** `WhyWeSkippedSection.tsx` looks up `categoryLabels[item.category]` directly. If the AI returns a category outside the 9 known values (`local-favorite`, `better-value`, `hidden-gem`, `insider-pick`, `overpriced`, `overcrowded`, `overhyped`, `tourist-trap`, `better-alternative`), the badge renders empty. The icon path uses `categoryIcons[item.category || 'local-favorite']` which still returns `undefined` for unknown categories.

5. **Better Alternatives has no AI payload validation.** `useSkipList` blindly trusts `data.skippedItems` from the edge function. A malformed entry (`{name: 'X'}` without `reason`) renders an empty `<p>` and no value chips. The hook also doesn't filter out entries lacking the required `name` and `reason` fields.

6. **No tests** for any of these four panels' data paths.

### Not bugs (verified)

- Voyance Intelligence is correctly gated: it only renders when `voyanceFinds > 0 || timingOptimizations > 0 || touristTrapsAvoided > 0 || insiderTips > 0`. So zero-state shows nothing rather than placeholder.
- Trip Completion derivations look right; the `analyzeHealth` and checklist code is straightforward and uses live trip data.
- Travel Intel uses `error || !intel` to short-circuit; no skeleton placeholder leaks through.

## Plan

### 1. Voyance Intelligence — replace fabricated savings with real ones

In `src/utils/intelligenceAnalytics.ts`:

- Sum **only the verifiable savings** from `skippedItems[].savingsEstimate` (already typed as `{money?: string; time?: string}`). Parse the existing strings (`"$40"`, `"3 hours"`, `"45 min"`) and add them up. If a skipped item has no `savingsEstimate`, contribute zero.
- Drop the `timing × 25`, `localPicks × $35`, `gems × $18` multipliers entirely.
- Drop the per-item `savingsTime: '20-30 min'` literal in `timingDetails`. Leave `savingsTime` undefined when we don't know.
- If the resulting totals are zero, return `estimatedSavings: undefined` so the "X saved vs typical itinerary" pill disappears.

Update the rendering in `EditorialItinerary.tsx` (lines 5777–5791) to handle the case where `estimatedSavings.time` is undefined but `money` is set, and vice versa (currently it assumes `time` always present).

### 2. Travel Intelligence — defensive rendering + payload sanity

Create `src/components/itinerary/travelIntel.ts` exporting `sanitizeTravelIntel(raw: unknown): TravelIntelData | null`:

- Returns `null` if the payload is missing the four core sections (`gettingAround`, `moneyAndSpending`, `bookNowVsWalkUp`, `weatherAndPacking`).
- For each section, drop sub-fields that are not non-empty strings; collapse empty arrays.
- Specifically guards `moneyAndSpending.mealCosts` — if missing or all three sub-keys empty, drop the pills row.
- Filters `eventsAndHappenings`/`bookNowVsWalkUp.bookNow`/`walkUpFine`/`localCustomsAndEtiquette`/`insiderTips`/`neighborhoodGuide.walkingDistance` to drop entries missing required fields.

Wire `TravelIntelCard` to call `sanitizeTravelIntel(data.data)` before `setIntel(...)`. If the result is `null`, surface the existing `error` state ("Travel intelligence is temporarily unavailable").

Replace direct `{intel.moneyAndSpending.mealCosts.budget}` accesses with conditional rendering of the pills row when `mealCosts` is present.

### 3. Travel Intelligence — cache invalidation on personalization change

Extend the cache key match in `generate-travel-intel/index.ts` to include `archetype`, `interests` (sorted), and `hotelArea`. Compare against the cached `request_params` JSON. Mismatch → re-fetch instead of returning stale.

### 4. Better Alternatives — payload validation + safe rendering

In `useSkipList.ts`:

- Filter `data.skippedItems` to entries with a non-empty `name` AND `reason`. If filtering empties the list, fall back to the hardcoded list rather than caching `[]`.
- Don't `sessionStorage.setItem` an empty array.

In `WhyWeSkippedSection.tsx`:

- Coerce unknown categories to `'local-favorite'` for both icon and label lookup, so the badge always has text.
- Guard against entries with missing `category` (already does for icons, fix for labels).

### 5. Tests

Create:

- `src/utils/__tests__/intelligenceAnalytics.test.ts` — verify estimated savings come only from real `skippedItems` data; zero out when no savings; parse `"$40"` / `"3 hours"` / `"45 min"` correctly; aggregate across items.
- `src/components/itinerary/__tests__/travelIntel.test.ts` — `sanitizeTravelIntel` returns `null` for missing core sections; drops empty `mealCosts`; filters malformed events; preserves valid payloads unchanged.
- `src/hooks/__tests__/useSkipList.test.ts` — filters out entries missing `name`/`reason`; falls back to hardcoded when AI returns empty/invalid; doesn't cache empty arrays.

### 6. Memory

Add `mem://technical/itinerary/intelligence-panels-integrity`: each panel's data source, the no-fabricated-savings rule (Voyance Intelligence savings come exclusively from `skippedItems`), and the sanitizer requirement for AI payloads (Travel Intel + Better Alternatives must validate before render).

## Out of scope

- Redesigning the panels visually.
- Changing what edge functions return (other than the cache-key fix).
- Trip Completion logic (it's healthy).
- Adding new countries to the hardcoded skip list.

## Files

- `src/utils/intelligenceAnalytics.ts` (real savings, no multipliers)
- `src/components/itinerary/EditorialItinerary.tsx` (handle undefined `time`)
- `src/components/itinerary/travelIntel.ts` (new — sanitizer)
- `src/components/itinerary/TravelIntelCard.tsx` (call sanitizer; guard `mealCosts`)
- `supabase/functions/generate-travel-intel/index.ts` (cache key includes personalization)
- `src/hooks/useSkipList.ts` (validate + don't cache empty)
- `src/components/itinerary/WhyWeSkippedSection.tsx` (safe category fallback)
- `src/utils/__tests__/intelligenceAnalytics.test.ts` (new)
- `src/components/itinerary/__tests__/travelIntel.test.ts` (new)
- `src/hooks/__tests__/useSkipList.test.ts` (new)
- `mem://technical/itinerary/intelligence-panels-integrity` (new)
