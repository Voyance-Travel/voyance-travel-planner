

## Fix Breakfast Restaurant Repetition — Strengthen AI Prompt for Unique Restaurants

### Analysis

The codebase already has:
1. **Debug logging** at line 347 of `action-generate-trip-day.ts` — already logs `usedRestaurants received (N): [...]`
2. **Three blocklist sections** in `compile-prompt.ts` (lines 983-1004) — pool-based blocklist, variety rule, and hard blocklist

Despite this, the AI still repeats restaurants. The fix is to add a stronger, more prominent "RESTAURANT UNIQUENESS" instruction block higher up in the prompt (in the system-level instructions near the timing/structure section) rather than only at the bottom with the pool data. Instructions closer to the top of the prompt carry more weight.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

Add a prominent RESTAURANT UNIQUENESS block inside `timingInstructions` (around line 465, after the PRACTICAL TIPS section and before the hotel line). This places it in the structural rules section where the AI pays the most attention, not buried at the bottom with data:

```ts
RESTAURANT UNIQUENESS — ABSOLUTE REQUIREMENT:
- EVERY restaurant across the ENTIRE trip must be UNIQUE. No restaurant name may appear on more than one day.
- This includes breakfast, lunch, dinner, cocktails, and nightcaps.
- You are given a list of already-used restaurants. You MUST NOT use ANY restaurant from that list.
- Even if an already-used restaurant seems like a perfect fit, choose a DIFFERENT one instead.
- For breakfast: every city has dozens of breakfast spots. NEVER repeat a breakfast venue.
- CHECK your output: if any restaurant name matches one in the used list, REPLACE it before responding.
```

This goes right after the "PRACTICAL TIPS" block (line 466) and before the hotel instructions. It reinforces the existing blocklist data with a structural rule the AI is more likely to respect.

### Files to edit
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add prominent RESTAURANT UNIQUENESS instruction block in the timing/structure section

### Verification
Generate a 4-day Lisbon trip. Check that every breakfast, lunch, and dinner uses a different restaurant. Check logs for the existing "usedRestaurants received" debug output to confirm blocklist is passed correctly.

