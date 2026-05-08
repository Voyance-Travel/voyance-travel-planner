## Problem

Michelin/luxury venue pricing has **two confirmed failure directions**, both caused by the same root issue: the cost-snapshot/repair pipeline (`action-repair-costs.ts`) implements its own copy of the Michelin floor — **without** the recent drinks/nightcap guards or the bar-price cap that already exist in `sanitization.ts`. The two layers drift, so corrections made at one layer get clobbered (or never made) at the other.

| Direction | What user sees | Root cause |
|---|---|---|
| **Over-pricing** ("Quadri nightcap = €206/pp") | A bar/café visit at a Michelin venue gets the Michelin floor applied | `enforceMichelinPriceFloor` in `sanitization.ts` skips drinks (recent fix), but the **parallel floor logic in `action-repair-costs.ts` (lines ~340-411) has no `EXPLICIT_DRINKS_RE` bypass**. Repair re-floors the nightcap and writes JSONB back via the parity path → display now shows €206. |
| **Under-pricing** ("card €26/pp, budget $500") | Card displays the AI's low estimate, while `activity_costs` snapshot has the true Michelin floor | Same divergence in reverse: floor was applied at the snapshot but JSONB writeback either didn't run (older trips before the parity fix) or the activity didn't match `michelin_floor`/`auto_corrected` source so it was excluded from the writeback set. |

There is also no **bar/nightcap cap** at all in `action-repair-costs.ts`. So even if AI emits €80 for a "Cocktails at the rooftop" card, sanitization caps it to €35 in JSONB but repair writes $80 to `activity_costs` from the AI-supplied seed → fresh divergence.

## Fix — single source of truth for fine-dining/bar pricing rules

### 1. Extract shared classifier `_shared/fine-dining-classifier.ts`

A pure function that takes `{ title, venueName, description, restaurantName, currentPrice }` and returns a tagged decision:

```ts
type Decision =
  | { kind: 'skip'; reason: string }                                          // not dining-related
  | { kind: 'cap_bar'; floorPrice: number; reason: string }                   // drinks/nightcap → cap at €35
  | { kind: 'apply_floor'; floorPrice: number; stars: number; reason: string }
  | { kind: 'noop' };
```

It encapsulates **all** of: `KNOWN_FINE_DINING_STARS`, `KNOWN_CASUAL_VENUES`, `EXPLICIT_DRINKS_RE`, `LUXURY_HOTEL_SIGNATURE_RE`, `RESTAURANT_LEAD_RE`, `KNOWN_MICHELIN_HIGH/MID`, `KNOWN_UPSCALE`, `BAR_KEYWORDS`, the casual-type guard, the meal-keyword guard for drinks, and the `MICHELIN_FLOOR.{upscale,mid,high}` thresholds.

### 2. Refactor both consumers to call the classifier

- **`sanitization.ts`** — `enforceMichelinPriceFloor` and `enforceBarNightcapPriceCap` keep their public signatures but delegate the rule logic to the classifier; they retain only the field-write side-effects (`writePriceToAllFields`, log emission). Behavior unchanged.
- **`action-repair-costs.ts`** — Replace the inline Strategy 1-4 block (lines ~340-411) with a single classifier call. Add **a new bar-cap branch**: if the classifier returns `cap_bar`, set `costPerPerson = MAX_BAR_PRICE` (35 EUR equivalent in USD), set `source = 'bar_cap_repair'`, log `[BAR_CAP_REPAIR]`. Include `'bar_cap_repair'` in the `correctedById` set so it participates in the existing JSONB parity writeback (lines 587-646).

### 3. Currency note

`MICHELIN_FLOOR.*` and `MAX_BAR_PRICE` constants are nominal-EUR thresholds; `cost_per_person_usd` in `activity_costs` is USD. Use the existing `usdFromEur` helper if present, else add a one-line constant `EUR_TO_USD_FLOOR = 1.08` (matches what `sanitization.ts` uses today). Centralize in the classifier so both sites round identically.

### 4. Tests

- Extend `__tests__/michelin-floor.test.ts`:
  - `repair-costs path: "Gran Caffè Quadri nightcap" at $206 → capped to ~$38 with source 'bar_cap_repair'`
  - `repair-costs path: "Dinner at Ristorante Quadri" at $30 → raised to $65 (1-star floor) with source 'michelin_floor'`
  - `repair-costs path: "Cocktails at Aman Venice rooftop" at $90 → capped (luxury hotel signature does NOT override drinks framing)`
- Add a parity test asserting `sanitization.enforceMichelinPriceFloor` and `repair-costs` decision converge on the same fixture set (10 inputs, both must produce the same final per-person price).

### 5. Memory

Update `mem://constraints/itinerary/michelin-pricing-defense-in-depth.md` to note the now-unified classifier and add `mem://constraints/itinerary/repair-costs-bar-cap-parity.md` documenting that `action-repair-costs.ts` MUST never apply a Michelin floor without first checking `EXPLICIT_DRINKS_RE`, and MUST apply the bar cap when the classifier returns `cap_bar`.

## Out of scope

- UI rendering changes (card chip already pulls from snapshot/JSONB in correct order per `Table-Driven Cost Architecture`).
- DB migration — `activity_costs` schema unchanged; `source` enum already accepts free-form strings.
- Generation prompt changes.

## Files touched

- **New**: `supabase/functions/_shared/fine-dining-classifier.ts`
- **New**: `mem://constraints/itinerary/repair-costs-bar-cap-parity.md`, updated `mem://index.md` + `mem://constraints/itinerary/michelin-pricing-defense-in-depth.md`
- **Edited**: `supabase/functions/generate-itinerary/sanitization.ts` (delegate to classifier, keep field writers)
- **Edited**: `supabase/functions/generate-itinerary/action-repair-costs.ts` (delegate to classifier; add `cap_bar` branch + JSONB writeback inclusion)
- **Edited**: `supabase/functions/generate-itinerary/__tests__/michelin-floor.test.ts` (new repair-path + parity tests)

## Acceptance

- A "Gran Caffè Quadri nightcap" emitted at €206 by AI is capped to ~€35 in BOTH `activity_costs.cost_per_person_usd` AND `trips.itinerary_data.days[*].activities[*].cost.amount` after a single repair pass.
- "Dinner at Ristorante Quadri" emitted at €30 is floored to €65 in BOTH locations.
- A legacy trip with `card €26 / budget $500` resolves to a single floored value in both fields after running `action-repair-costs`.
- `[BAR_CAP_REPAIR]` and `PARITY OK` appear in repair logs.
