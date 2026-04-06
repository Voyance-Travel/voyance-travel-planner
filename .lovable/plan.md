

## Expand Michelin Price Floor to Multi-City

### What's wrong
The `KNOWN_FINE_DINING_STARS` map in `sanitization.ts` only contains Lisbon restaurants. The enforcement helper works correctly but has nothing to match against for Berlin, Paris, Rome, etc. Result: 8 Michelin restaurants priced as low as €11/pp.

### Changes

#### 1. Expand `KNOWN_FINE_DINING_STARS` in `sanitization.ts` (lines 46–72)
Replace the Lisbon-only map with the full multi-city version covering Lisbon, Berlin, Paris, Rome, Barcelona, London, Amsterdam, Vienna, Madrid, Milan, Copenhagen, Munich, and Istanbul — approximately 120 entries total. Keep all existing Lisbon entries, add the rest.

#### 2. Update prompt examples in `compile-prompt.ts` (lines 816–821)
Extend the "SPECIFIC EXAMPLES" section to include non-Lisbon restaurants:
- Guy Savoy (Paris, 3-star): minimum €250/pp
- Facil (Berlin, 2-star): minimum €180/pp
- Horváth (Berlin, 1-star): minimum €120/pp

Change the general instruction to say "ALL CITIES" to make it clear this isn't Lisbon-specific.

#### 3. No other changes needed
- The `enforceMichelinPriceFloor` helper already runs as the final pricing step in `action-generate-day.ts` and `action-generate-trip-day.ts`
- The `action-repair-costs.ts` already imports and iterates `KNOWN_FINE_DINING_STARS`
- The matching logic (substring, stripped title, venue name) is city-agnostic
- `deduplicateEveningFineDining` is untouched

### Files to edit

| File | Change |
|------|--------|
| `sanitization.ts` | Replace lines 46–72 with expanded ~120-entry multi-city map |
| `compile-prompt.ts` | Add Berlin/Paris/Barcelona examples to lines 816–821, label rules as "ALL CITIES" |

