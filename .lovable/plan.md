

## Fix Michelin Restaurant Underpricing — Raise Known Fine Dining Floors

### Root Cause

`sanitization.ts` lines 350-387 already has a dining price floor system, but it's too weak:
- Known high-end restaurants (including `eleven`) only get a €60 floor (line 369)
- Michelin detection requires the AI to explicitly write "michelin" in the description — which it often doesn't
- Result: Eleven gets floored to €60 at best, but if the AI prices it at €28 and the text doesn't say "michelin", only the €60 known-restaurant floor catches it

The fix is to raise the known restaurant floors to match actual Michelin pricing, and expand the list.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/sanitization.ts`** (lines 368-376)

Replace the single "known high-end restaurant" block with tiered known-restaurant floors:

```ts
// Known Michelin-starred / fine dining — tiered by actual price range
const knownMichelinHigh = /\b(belcanto|feitoria|fifty\s*seconds)\b/i;
const knownMichelinMid = /\b(alma|eleven|epur|cura|loco|eneko)\b/i;
const knownUpscale = /\b(il\s*gallo|ceia|enoteca|sommelier)\b/i;

if (floor < 150 && knownMichelinHigh.test(combined)) {
  floor = 150; reason = 'Known top-tier Michelin restaurant';
} else if (floor < 120 && knownMichelinMid.test(combined)) {
  floor = 120; reason = 'Known Michelin-starred restaurant';
} else if (floor < 60 && knownUpscale.test(combined)) {
  floor = 60; reason = 'Known upscale restaurant';
}
```

This replaces lines 368-371 (the single `floor = 60` block). The seafood and generic dinner floors below remain unchanged.

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — upgrade known restaurant floors from flat €60 to tiered €120-150

### Verification
Generate a Lisbon trip. Any appearance of Eleven, Alma, Epur should be priced ≥€120/pp. Belcanto, Feitoria should be ≥€150/pp. Check edge function logs for `[UNDERPRICED]` warnings.

