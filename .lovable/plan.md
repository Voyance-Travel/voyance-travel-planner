

## Prompt 41: Raise Michelin Price Floor + Prevent Double Fine Dining

### What exists today

The Michelin price floor logic lives in `sanitization.ts` lines 575-620, inside `sanitizeGeneratedDay`. It already has:
- Tiered regex detection (3-star: 180, 2-star: 120, 1-star: **80**)
- Named restaurant lists (`knownMichelinHigh` at 150, `knownMichelinMid` at 120, `knownUpscale` at 60)

The prompt in `compile-prompt.ts` lines 806-815 instructs the AI with Michelin minimums (1-star: €80, 2-star: €120, 3-star: €180).

There is **no** double-fine-dining deduplication anywhere.

### Root cause of Bug A

The 1-star floor is €80 and the `knownMichelinMid` list (which includes `eleven`) applies a floor of €120 — but only when the generic regex floor is below 120. The issue: the generic regex `michelin\s*1|1[\s-]*star` sets `floor = 80` first, then the `knownMichelinMid` check raises it to 120 only if `floor < 120`. So Eleven should get 120. However, if the AI generates a price of €87, the floor check `act.cost.amount < floor` with `floor = 120` should catch it. This means either: (a) the cost field shape doesn't match `act.cost.amount`, or (b) the price is set after sanitization by another step.

Looking more carefully: the condition is `act.cost && typeof act.cost === 'object' && act.cost.amount > 0` — if the AI returns cost as a flat number or as `price_per_person`, this entire block is skipped. That's the real bug.

### Plan

#### 1. Raise price floors in sanitization.ts (lines 582-604)

- 1-star regex floor: 80 → **120**
- 2-star regex floor: 120 → **180**
- 3-star regex floor: 180 → **250**
- `knownMichelinHigh` floor: 150 → **180**
- `knownMichelinMid` floor: stays 120
- Fine dining / tasting menu generic: 80 → **120**
- Update prompt in `compile-prompt.ts` to match (lines 807-809)

#### 2. Fix cost shape handling in the dining floor check (line 577)

The current guard `act.cost && typeof act.cost === 'object' && act.cost.amount > 0` misses activities where cost is a flat number or stored in `price_per_person`/`estimated_price_per_person`. Reuse the same `resolveCostField` pattern from `checkAndApplyFreeVenue` to read cost from all shapes, and write back to all relevant fields when applying the floor.

#### 3. Add evening fine-dining deduplication in sanitization.ts

After the existing activity loop in `sanitizeGeneratedDay`, add a post-pass that:
- Finds all DINING activities after 18:00 that are fine dining (booking_required, price >= 80, or title matches michelin/tasting/starred)
- If 2+ found, keeps the most expensive, removes the rest
- Logs `DOUBLE FINE DINING` warning

#### 4. Add AI prompt instruction in compile-prompt.ts

After the restaurant pricing rules block (~line 815), add:
```
DINING RULES:
- Schedule exactly ONE dinner restaurant per evening. Never schedule two fine dining or Michelin-starred restaurants in the same evening.
- If you want to include a second evening venue, make it a bar, cocktail lounge, fado house, or nightcap — NOT another full-service restaurant.
```

### Files to edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Raise floors, fix cost shape handling, add evening dedup |
| `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` | Raise prompt minimums, add dining rules |

No new files. No changes to the known restaurant lists. Existing free-venue logic untouched.

### Verification

- Eleven: should hit `knownMichelinMid` floor → €120 minimum
- Belcanto: should hit `knownMichelinHigh` floor → €180 minimum
- No evening should have two DINING+booking_required activities
- Console logs: `[UNDERPRICED]` and `DOUBLE FINE DINING`

