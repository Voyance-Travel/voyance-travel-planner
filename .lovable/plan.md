

## Fix Departure-Day Restaurant Repetition + Price Consistency

### Analysis

The departure day (typically Day 4) consistently fails on restaurant uniqueness. The `usedRestaurants` blocklist is passed correctly, but the AI ignores it on the final day. The existing prompt has generic uniqueness rules but nothing departure-day-specific. The fix adds two targeted reinforcements.

### Plan (2 files)

**File 1: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

In the user prompt section (around line 1013, after the HARD RESTAURANT BLOCKLIST block), add a departure-day-specific restaurant block that fires when `isLastDay` is true:

```
if (isLastDay && usedList.length > 0) {
  // Add DEPARTURE DAY RESTAURANT RULES with the full used list
  // and a list of safe Lisbon alternatives for lunch
}
```

This block will:
- Explicitly state "This is the FINAL DAY" and list all used restaurants
- Provide safe departure-day lunch alternatives (Ponto Final, Café de São Bento, O Velho Eurico, Mercado da Ribeira, Cervejaria Trindade, Tasca do Chico, etc.)
- Instruct: "If your first choice matches ANY name above, REPLACE immediately"
- Forbid generic placeholders

**File 2: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

After each day's result is assembled and used restaurants are updated (post-generation loop), add a cross-day price consistency check:
- Build a `Map<normalizedName, {price, dayIndex}>` across all assembled days
- When a duplicate restaurant is found, log a `PRICE INCONSISTENCY` warning and normalize to the higher price
- Also add a departure-day debug log confirming the usedRestaurants count when `dayNumber === totalDays`

### Files to edit
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add departure-day-specific restaurant uniqueness block in user prompt
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — add cross-day price consistency check + departure-day debug log

### Verification
Generate a 4-day Lisbon trip. Day 4 lunch should use a different restaurant than Days 1-3. No restaurant should appear on multiple days. Check logs for "DEPARTURE DAY" entries confirming the blocklist is passed.

