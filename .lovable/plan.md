

## Fix: Budget Coach Suggests Duplicate Restaurants Across Days

### Problem
The Budget Coach can suggest the same replacement restaurant (e.g., "Pasticceria Rizzardini") for multiple breakfast slots on different days. If both are applied, the itinerary has the same venue on consecutive mornings.

### Root Cause
The prompt at line 110 asks for "5-8 specific cost-cutting swaps" but has no instruction to avoid repeating the same replacement venue across suggestions. The AI picks the best-known cheap option and reuses it.

### Fix (1 file, ~3 lines)

**File: `supabase/functions/budget-coach/index.ts`**

Add a variety rule to the user prompt (after line 129, in the "Rules:" section):

```
- NEVER suggest the same replacement venue/restaurant in more than one suggestion. Each swap must recommend a DIFFERENT specific place, even if multiple items are in the same category (e.g., if two breakfasts need swaps, suggest two different affordable cafés).
```

### Scope
1 edge function file, 1 line added to the prompt. No client-side changes.

