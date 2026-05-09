## HC.2 — Unify `isTransitActivity`

Create one shared helper and swap the three call sites listed in the request.

### 1. New file: `supabase/functions/_shared/transit-detect.ts`

Exports `TRANSIT_CATS`, `TRANSIT_TITLE_RE`, `isTransitActivity(act)` exactly as specified in the request — 8 categories (`transit`, `transport`, `transportation`, `travel`, `transfer`, `commute`, `taxi`, `walking`) plus title regex fallback for verbs (walk/travel/transfer/drive/ride/taxi/train/bus/metro/tram/ferry/boat/water taxi/vaporetto/return/return to/head back).

### 2. Swap call sites

**a. `supabase/functions/_shared/orphan-transit.ts`**
- Delete local `TRANSIT_CATS` (line 16) and local `isTransitActivity` (lines 25–29).
- `import { isTransitActivity } from './transit-detect.ts'`.
- Existing usages at lines 59 and 85 keep working unchanged.

**b. `supabase/functions/generate-itinerary/sanitization.ts`**
- Delete local `isTransitActivity` (line 854).
- `import { isTransitActivity } from '../_shared/transit-detect.ts'`.
- Usage at line 892 keeps working.

**c. `supabase/functions/generate-itinerary/pipeline/validate-day.ts` → `checkWalkOverThreshold`**
- At line 1059, replace `if (cat !== 'transport' && cat !== 'transit') continue;` with `if (!isTransitActivity(act)) continue;` (and drop the now-unused `cat` local if it was only used there).
- Add import from `../../_shared/transit-detect.ts`.

### Out of scope (intentionally not touched)

The request names exactly these three call sites. Other locations also have local transit-cat sets but are **not** part of HC.2:
- `refresh-day/index.ts` (lines 132/163) — own 7-cat list, used in distance/cost math.
- `_shared/timing-cascade.ts` (line 116) — same 7-cat list, used in cascade logic.
- `pipeline/repair-day.ts` (line 4330) — local `TRANSIT_CATS_FE` for a specific repair pass.

Leaving them as-is keeps the diff minimal and matches the user's instructions verbatim. Can be unified in a follow-up if desired.

### Expected result

After the swap, walk-threshold validation in `validate-day.ts` catches `transportation` / `travel` / title-only transit cards uniformly — same as `orphan-transit` and `sanitization` already do once they import the shared helper.
