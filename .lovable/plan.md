

## Fix Ticketed Attractions Being Marked as Free (Colosseum at €0)

### Root Cause

"Colosseum Arena Floor Exploration" doesn't contain any word from `PAID_EXPERIENCE_RE` (museum, castle, palace, tower, etc.), so `checkAndApplyFreeVenue` doesn't exclude it. Meanwhile, the word "walk" or other free-venue patterns in the description text can trigger `ALWAYS_FREE_VENUE_PATTERNS`, zeroing the price. There's no mechanism to restore prices for known ticketed attractions after the free-venue pass.

### Plan

#### 1. Add `KNOWN_TICKETED_ATTRACTIONS` map to `sanitization.ts` (~after line 36)

A `Record<string, number>` mapping lowercase venue substrings to minimum admission prices (EUR). Covers Rome, Berlin, Lisbon, Paris, Barcelona, and London (~40 entries). Export it for use in `action-repair-costs.ts` too.

#### 2. Add `enforceTicketedAttractionPricing()` helper to `sanitization.ts` (~after `enforceMichelinPriceFloor`)

Logic:
- Resolve current price from all field shapes
- If price > 0, return (already priced)
- Check title and venue_name against `KNOWN_TICKETED_ATTRACTIONS` keys (substring match)
- If matched, write the minimum price using existing `writePriceToAllFields`
- Also: if `booking_required` is true AND price is 0 AND category is EXPLORE/ACTIVITY, log a warning

#### 3. Call the new function in three places

| Location | When |
|----------|------|
| `sanitization.ts` ~line 912 | Right AFTER `checkAndApplyFreeVenue()` in `sanitizeGeneratedDay` |
| `action-generate-trip-day.ts` ~line 1584 | After `enforceMichelinPriceFloor` in the final guard loop |
| `action-repair-costs.ts` ~line 134 | After the free venue check, before pushing the cost row |

This ensures: free venue zeroing runs first → ticketed attraction restore runs second → Michelin floor runs last.

#### 4. Expand `PAID_EXPERIENCE_RE` (line 23)

Add `colosseum|coliseum|amphitheatre|amphitheater|archaeological|ruins|excavation|arena` to prevent the Colosseum (and similar sites) from matching free-venue patterns in the first place. This is a belt-and-suspenders approach.

#### 5. Update prompt in `compile-prompt.ts`

Add a "TICKETED ATTRACTION PRICING" section with examples (Colosseum €16-35, Vatican Museums €17, Louvre €17, Sagrada Familia €26) and the rule that "Booking Required" attractions should never be Free.

### Files to edit

| File | Change |
|------|--------|
| `sanitization.ts` | Add `KNOWN_TICKETED_ATTRACTIONS` map, `enforceTicketedAttractionPricing()` helper, expand `PAID_EXPERIENCE_RE` |
| `action-generate-trip-day.ts` | Call `enforceTicketedAttractionPricing` in final guard loop |
| `action-repair-costs.ts` | Call ticketed attraction check after free venue check |
| `compile-prompt.ts` | Add ticketed attraction pricing rules to system prompt |

