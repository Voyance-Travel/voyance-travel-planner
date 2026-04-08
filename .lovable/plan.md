

## Kill Filler/Placeholder Activities

### The Problem
AI generates fake "filler" activities like "End of Day Reflection in Central Paris" with city-level addresses and nonzero prices. These are not real activities.

### The Fix (2 files, inline filters)

Add a **filler activity filter** immediately after the existing hallucination filter in both generation files. Same pattern — inline block, no new files.

#### 1. `action-generate-trip-day.ts` (~line 821, right after hallucination filter closing brace)

Insert a new filter block:
- **Title patterns**: Strip activities matching known filler patterns (`/end of day reflection/i`, `/rest and reflect/i`, `/evening.*reflection/i`, `/day.*reflection/i`, `/quiet.*reflection/i`, `/final.*moment/i`, etc.)
- **Paid activities with city-only addresses**: For any activity with `price > 0` (checking `act.cost?.amount` or `act.estimatedCost?.amount`), verify the address contains a real street indicator (`/\d+\s+\w|rue|avenue|boulevard|place|quai|passage|street|road/i`). If the address is just a city name (`/^[a-z\s\-']+,?\s*(france|italy|germany|japan|spain|uk|usa)?$/i`) or is under 30 chars with no street indicator, remove it.

#### 2. `action-generate-day.ts` (~line 382, right after hallucination filter closing brace)

Same filter block on `normalizedActivities`.

### Files Changed
1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — add filler filter after hallucination filter
2. `supabase/functions/generate-itinerary/action-generate-day.ts` — add same filler filter after hallucination filter

