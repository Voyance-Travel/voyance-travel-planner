## Bug 1 — "Casual neighborhood dinner" label survives venue swap

**Root cause confirmed.** `stripVenueIdentity` in `supabase/functions/generate-itinerary/ledger-check.ts` (lines 26–55) clears every venue-identity field except `title` and `name`. In the verified-fallback branch, `applyFallbackToActivity` (`fix-placeholders.ts` line 442) DOES rewrite `activity.title = "${MealLabel} at ${fallback.name}"`, so the label is overwritten there. But:

- The same function never touches `title` if the fallback resolver throws or returns `needsVenuePick` — the worst-case branch (lines 386–402) does set `title`/`name`/`cost`, but anything that lives between `stripVenueIdentity` and `applyFallbackToActivity` (e.g. an exception during `resolveAnyMealFallback`, or future call sites that strip identity but resolve elsewhere) leaves the prestige label dangling.
- More importantly, the LLM emission path is unconstrained: no rule in the MEAL DETAILS block of `prompt-library.ts` (lines 1295–1299) ties the title's prestige descriptor to the venue tier. The model can independently emit `"Casual neighborhood dinner"` as a title alongside a Michelin-tier venue when generating from scratch, and nothing post-hoc cross-checks the two fields.

## Bug 2 — €206 nightcap on Gran Caffè Quadri

`enforceBarNightcapPriceCap` (`sanitization.ts` lines 804–838) already covers the canonical pattern: title contains "nightcap"/"cocktail"/"caf[eé]" → cap at €55 even on Michelin keys. So a literal "Gran Caffè Quadri nightcap" should be capped.

The leak path that survives is when the strip-and-refill flow leaves the **old dinner's price** on the activity's `cost.amount` / `cost.perPerson` / `cost_per_person` after `stripVenueIdentity`, and the new venue is something the bar cap doesn't fire on (no drinks/nightcap framing, no `BAR_KEYWORDS` match — e.g. just "Drinks at Gran Caffè Quadri" rendered without the nightcap keyword, or a café slot whose title reads as a meal). `stripVenueIdentity` keeps `cost`, `cost_per_person`, and `metadata.cost_floor` intact (regex only deletes `cost_floor_reason`). The new venue inherits the dinner price.

## Fix

### 1. `ledger-check.ts` — extend `stripVenueIdentity` to also clear label + price context

Add to the strip:
- `a.title = null`, `a.name = null` (let `applyFallbackToActivity` rebuild from venue; worst-case branch already sets explicit text)
- `a.cost = null`, `a.cost_per_person = null`, `a.price = null`, `a.estimatedCost = null`, `a.estimated_price_per_person = null`, `a.price_per_person = null`
- Extend the metadata regex to also delete `cost_floor` and `cost_floor_reason` (currently only `cost_floor_reason` matches the prefix), so the new venue isn't pinned to the old floor

### 2. `prompt-library.ts` — add MEAL DETAILS title/prestige constraint

In the MEAL DETAILS block (after line 1299), append:

```
- Title prestige MUST match venue tier: do NOT label a Michelin/fine-dining venue as "casual" or "neighborhood"; do NOT label a café/bistro as "tasting menu" or "signature dinner".
- Use formats like: "Signature dinner at <Venue>" / "Tasting menu at <Venue>" for fine dining, "Dinner at <Venue>" for mid-tier, "Casual <meal> at <Venue>" only for genuinely casual venues.
```

### 3. `prompt-library.ts` — bound evening/nightlife pricing

In the EVENING/NIGHTLIFE block, add:
```
- Cap evening/nightcap/café/drinks-only stops at €30/person unless it is an explicit ticketed show or tasting experience. Never inherit dinner-tier pricing for a drinks stop.
```

### 4. (Defense in depth) `fix-placeholders.ts::applyFallbackToActivity`

After computing `price`, if the activity already has a `cost.amount` from a stripped predecessor and `price` is set, overwrite `cost.perPerson` and `price_per_person` (currently only `cost.amount` and `cost_per_person` are written). Mirrors the canonical-cents parity rule.

### Tests

- Add Deno test in `ledger-check.test.ts`: vibe-clash downgrade clears `title`, `cost.amount`, `cost_per_person`, `metadata.cost_floor` BEFORE fallback applies.
- Add unit test that a pre-seeded activity with `cost.amount=200` going through `stripVenueIdentity` then `applyFallbackToActivity({price: 45})` ends with all three of `cost.amount`, `cost.perPerson`, `cost_per_person` equal to 45.

### Files touched

- `supabase/functions/generate-itinerary/ledger-check.ts`
- `supabase/functions/generate-itinerary/fix-placeholders.ts`
- `supabase/functions/generate-itinerary/prompt-library.ts`
- `supabase/functions/generate-itinerary/ledger-check.test.ts` (new assertions)

No UI changes. Redeploy `generate-itinerary`. Add memory entry under `mem://constraints/itinerary/strip-venue-identity-clears-label-and-price`.
