

## Fix Severe Restaurant Underpricing — Prompt Guidance + Post-Generation Price Floor

### Root cause

The AI prompt has detailed pricing rules for **transport** but **zero guidance for dining**. Restaurant pricing is left entirely to the AI's discretion, which produces wildly inconsistent results between generations. There is no post-generation price floor to catch obvious underpricing.

### Plan

**1. Add dining pricing rules to `compile-prompt.ts`**

After the existing transport pricing block (around line 797), insert a `RESTAURANT PRICING` section:

```
RESTAURANT PRICING — USE REALISTIC PRICES:
• Michelin 3-star / destination restaurants: minimum €180/pp
• Michelin 2-star restaurants: minimum €120/pp
• Michelin 1-star / high-end tasting menus: minimum €80/pp
• Well-known fine dining (non-starred): minimum €60/pp
• Famous seafood restaurants (e.g., cervejaria, marisqueira): minimum €40/pp
• Mid-range sit-down restaurants: €20-50/pp
• Casual dining and cafés: €10-30/pp
• Fast casual, bakeries, pastéis: €5-15/pp
When in doubt, price HIGHER. Underpricing makes the itinerary unreliable. Use the actual price a real diner would pay at that specific restaurant.
```

**2. Add post-generation price floor check in `sanitization.ts`**

After the existing free-venue zeroing block (around line 315), add a dining underpricing detector. For each dining activity:

- Extract cost from `act.cost.amount`
- Check title/description/venue for Michelin indicators (`michelin`, `starred`, `tasting menu`, `fine dining`) → floor at 80
- Check for known high-end restaurant names (Belcanto, Alma, Feitoria, Eleven, etc.) → floor at 60
- Check for famous seafood indicators (`cervejaria`, `marisqueira`) → floor at 40
- Check for generic dinner at a named restaurant under €15 → warn + floor at 15

Auto-correct by setting `act.cost.amount = Math.max(act.cost.amount, floor)` and log each correction. This is deterministic and cannot be ignored by the AI.

### Files to edit
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add dining pricing rules
- `supabase/functions/generate-itinerary/sanitization.ts` — add price floor enforcement

### No changes to
- Generation pipeline architecture
- New files
- Cost reference table logic

### Verification
- Generate a Lisbon trip
- Belcanto should be €150+ (Michelin 2-star floor: €120, but AI should price higher with prompt guidance)
- Cervejaria Ramiro should be €40+ (seafood floor)
- No named dinner restaurant under €15
- Check console for `UNDERPRICED` correction logs

