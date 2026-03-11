

## Fix: Remove "Arrival and Baggage Claim" from Day 1

The "Arrival at Airport" activity is generated via the AI prompt AND reinforced by post-generation logic in the edge function. Since the Arrival Game Plan UI component already handles this information, the arrival activity is redundant. Here's what needs to change:

### Changes in `supabase/functions/generate-itinerary/index.ts`

**1. Update the AI prompt rule (line 1530)**

Change the Day 1 arrival structure instruction to tell the AI NOT to generate an airport arrival activity. Keep the hotel check-in requirement:

```
Day 1 MUST begin with "Hotel Check-in & Refresh" (category: accommodation) as the first activity. 
Do NOT include an "Arrival at Airport" or "Arrival and Baggage Claim" activity — arrival logistics are handled by a separate UI component. 
Do NOT include an "Airport Transfer to Hotel" activity either.
```

**2. Remove the arrival-sequence reordering logic (~lines 2553-2640)**

The block that finds arrival/transfer/checkin activities and reorders them should be simplified to only care about check-in positioning (or removed entirely since the AI prompt no longer generates an arrival activity).

**3. Remove the combined-arrival splitting logic (~lines 5780-5820)**

The Stage 2.55 block that splits a combined arrival block into "Arrival at Airport" + "Hotel Check-in" should stop creating the arrival activity. Only keep the check-in split.

**4. Add a post-generation filter**

After the AI generates the day, strip any activity whose title matches arrival/baggage patterns (as a safety net since the AI may still generate one despite the prompt):

```typescript
// Strip arrival/baggage activities from Day 1 — handled by Arrival Game Plan UI
if (isFirstDay) {
  generatedDay.activities = generatedDay.activities.filter(a => {
    const t = (a.title || '').toLowerCase();
    return !(t.includes('arrival at') && (t.includes('airport') || t.includes('baggage'))) &&
           !t.includes('baggage claim') &&
           !t.includes('airport arrival');
  });
}
```

### Changes in `supabase/functions/generate-itinerary/prompt-library.ts`

**5. Update required sequence (lines 1007-1011)**

Remove `'airport_arrival'` from the sequence labels so the prompt no longer instructs the AI to generate that step.

### Changes in `supabase/functions/generate-itinerary/day-validation.ts`

**6. Remove the arrival validation warning (lines 282-291)**

Remove or soften the warning that says "Day 1 should start with airport arrival" — this is no longer expected. Keep the check-in and transfer warnings if desired, or remove the transfer one too since that's also handled by the Arrival Game Plan UI.

### Summary

| File | What |
|------|------|
| `index.ts` line 1530 | Update prompt: no arrival activity |
| `index.ts` ~2553-2640 | Simplify arrival reordering (remove arrival part) |
| `index.ts` ~5780-5820 | Stop splitting into arrival activity |
| `index.ts` post-generation | Add safety-net filter to strip arrival activities |
| `prompt-library.ts` ~1007 | Remove `airport_arrival` from required sequence |
| `day-validation.ts` ~282-293 | Remove "Day 1 should start with airport arrival" warning |

