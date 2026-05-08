## Problem

Two recurring class bugs surface together on Quadri (Venice, 1-Michelin star, Piazza San Marco):

1. **Underpricing** — €26/pp for a Michelin-starred restaurant. Same shape as previous La Pergola / Oro at Belmond Cipriani regressions. Root cause: `KNOWN_FINE_DINING_STARS` in `supabase/functions/generate-itinerary/sanitization.ts` has **no Venice section at all** (Quadri, Glam Enrico Bartolini, Local, Met, Oro at Belmond Cipriani, Antinoo's Lounge / Aman Arva, Wistèria, Quadri's sister Caffè Florian — all missing). When a starred venue isn't in the map and the regex fallbacks (`KNOWN_MICHELIN_HIGH/MID/UPSCALE`) don't match, the name passes through and the LLM's casual `cost_mid_usd ≈ $25–30` (the "dinner" tier) sticks.

2. **Address is just a sestiere/neighborhood** — "San Marco" instead of "Piazza San Marco 121, 30124 Venezia VE, Italy". The same gap exists for any venue whose address has no digits (street number) or comma-delimited postal segment. Wellness already has a `hasNumericAddress` gate in `fix-placeholders.ts` line 688; dining/sightseeing/culture do not.

The user's directive — *"make sure the fix is universal"* — means we cannot just add Quadri. We need the static map to grow AND a defensive heuristic that catches the next missing entry before it reaches the user.

## Universal fix — three layers

### Layer 1: Expand the known-stars map (data)

Add a Venice section to `KNOWN_FINE_DINING_STARS` (and matching hotel-restaurant entries) so the explicit-name path catches them:

- `'quadri'`: 1, `'ristorante quadri'`: 1, `'alajmo quadri'`: 1
- `'glam'`: 1, `'glam enrico bartolini'`: 1
- `'local'`: 1, `'local venezia'`: 1
- `'oro'`: 2, `'oro restaurant'`: 2, `'oro belmond'`: 2 (Belmond Cipriani)
- `'aman venice'`: 1, `'arva'`: 1, `'arva aman'`: 1
- `'wistèria'`: 1, `'wisteria'`: 1
- `'met'`: 1, `'met restaurant'`: 1, `'met hotel metropole'`: 1
- `'antinoo's lounge'`: 1, `'antinoos lounge'`: 1 (Sina Centurion)
- `'club del doge'`: 1 (Gritti Palace)

Same migration also seeds a Florence and Naples micro-section (next likely victims):

- Florence: `'enoteca pinchiorri'` (3), `'borgo san jacopo'` (1), `'la leggenda dei frati'` (1), `'il palagio'` (1, Four Seasons Florence), `'sesto on arno'` (1, Westin)
- Naples: `'palazzo petrucci'` (1), `'george restaurant'` (1, Grand Hotel Parker's), `'il comandante'` (1, Romeo Hotel), `'aria'` (1)

### Layer 2: Heuristic floor for "starred venue inside a luxury hotel" (defensive)

Most missing-entry regressions follow one pattern: a Michelin-starred restaurant **inside a top-tier hotel**, where the LLM names the hotel and gives a casual price. Add a heuristic in `enforceMichelinPriceFloor` (universal-quality-pass.ts → calls into sanitization.ts):

- If the activity's title or description contains a luxury-hotel signature word (`belmond|cipriani|aman|bvlgari|bulgari|four seasons|gritti palace|st\.? regis|ritz[\- ]carlton|mandarin oriental|park hyatt|raffles|peninsula|rosewood|dorchester|connaught|claridge|savoy|setai|borgo|villa d'?este|hassler|de russie|principe di savoia|grand hotel`) **AND** the title contains a "Ristorante|Restaurant|Dinner at" lead **AND** no `KNOWN_FINE_DINING_STARS` match fired, then floor it at `MICHELIN_FLOOR.upscale` (€60/pp) and tag `metadata.cost_floor_reason = 'luxury_hotel_dining_heuristic'`.

This stops the bleeding for venues we haven't catalogued yet (the Cipriani/Quadri pattern). It's a *floor*, not a ceiling, so legitimate higher LLM prices stay.

### Layer 3: Address-quality gate (universal, not just wellness)

Promote the wellness-only `hasNumericAddress` rule from `fix-placeholders.ts` line 688 to a shared helper `isWeakAddress(address)` in `supabase/functions/_shared/address-quality.ts`:

```text
weak ⇔ address is null OR length < 8 OR no digit OR is a bare neighborhood
       (matches /^(san marco|cannaregio|castello|dorsoduro|santa croce|
                   san polo|trastevere|monti|chiado|alfama|le marais|
                   soho|shibuya|gion|...)\s*$/i)
```

Where it runs:

1. **Pre-save** (action-save-itinerary + persist-day-contract) — when a venue has `placeId` from Google Places but `isWeakAddress(location.address)`, re-fetch `formattedAddress` once via the existing `verifyVenueWithPlaces` cache; replace if returned address is stronger.
2. **Render-time UI safety net** — `src/components/itinerary/ActivityCard.tsx` (or wherever address is rendered) hides the address line when `isWeakAddress` is true and the activity has no `placeId`, instead of showing a misleading sestiere. (Falls back to "Tap for details" / Google Maps deep-link by name+city.)
3. **Backfill** — one-shot SQL UPDATE on `itinerary_days.activities` over the last 14 days, nulling out address strings that match the weak pattern so next render recovers via the UI gate.

Address line is *frontend/presentation* — no business-logic change there beyond hiding misleading data.

### Tests

- `sanitization.test.ts` (or new `michelin-floor.test.ts`): Quadri / Glam / Oro / "Dinner at Belmond Cipriani Restaurant" all floor at ≥ €120 (1-star) or ≥ €60 (heuristic), never €26.
- `address-quality.test.ts` (new): "San Marco", "Cannaregio", "" → weak; "Piazza San Marco 121, 30124 Venezia VE, Italy" → strong; "228 Rue de Rivoli" → strong.

### Memory updates

Append to `mem://technical/finance/table-driven-cost-architecture` (or create a sibling rule `mem://constraints/itinerary/michelin-pricing-defense-in-depth`):

> Michelin/luxury-hotel dining priced as casual (€26 dinner tier) is a recurring data-gap regression (La Pergola → Oro Belmond → Quadri). Defense in depth required: (1) explicit `KNOWN_FINE_DINING_STARS` map, (2) luxury-hotel-name heuristic that floors at `MICHELIN_FLOOR.upscale` even with no map hit, (3) per-venue address-quality gate hides bare-sestiere strings ("San Marco") and forces Google Places re-enrichment when `placeId` exists.

## Files

- **Edit** `supabase/functions/generate-itinerary/sanitization.ts` — Venice/Florence/Naples entries in `KNOWN_FINE_DINING_STARS`, add `LUXURY_HOTEL_DINING_RE` constant + `isLuxuryHotelDiningHeuristic(activity)` helper.
- **Edit** `supabase/functions/generate-itinerary/action-repair-costs.ts` and `universal-quality-pass.ts` — call the heuristic inside `enforceMichelinPriceFloor` when no explicit-star match found.
- **New** `supabase/functions/_shared/address-quality.ts` — `isWeakAddress`, `WEAK_NEIGHBORHOOD_RE`.
- **Edit** `supabase/functions/generate-itinerary/action-save-itinerary.ts` (or persist-day-contract) — re-enrich weak addresses when `placeId` present.
- **Edit** UI activity-address render path (likely `src/components/itinerary/*Card*.tsx`) — hide weak address line.
- **New** `supabase/functions/generate-itinerary/__tests__/michelin-floor.test.ts`, `supabase/functions/_shared/__tests__/address-quality.test.ts`.
- **Migration** — 14-day backfill nulling weak addresses on `itinerary_days.activities`.
- **Memory** — append/create the defense-in-depth rule above.

No schema changes required (no new tables/columns).
