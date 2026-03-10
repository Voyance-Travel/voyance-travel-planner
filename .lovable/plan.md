

## Fix: User Requirements Being Ignored in Just Tell Us Pipeline

This is a 4-layer fix across 3 edge function files. Each layer addresses a different point where user requirements get dropped.

---

### Layer 1: `findBestDay` skips Day 1/last day even when user explicitly requested it

**File:** `supabase/functions/generate-itinerary/must-do-priorities.ts` — Line 472-475

The guard unconditionally skips Day 1 and last day for activities >3 hours. Fix: respect `preferredDay`.

**Change:** Replace the `continue` with a conditional that checks if the user explicitly requested that day:
```ts
if ((d === 1 || d === totalDays) && (priority.estimatedDuration || 120) > 180) {
  if (!priority.preferredDay || priority.preferredDay !== d) {
    continue;
  }
}
```

---

### Layer 2: `parseMustDoInput` can't resolve day-of-week or multi-day references

**File:** `supabase/functions/generate-itinerary/must-do-priorities.ts`

**2a.** Add `tripStartDate` and `totalDays` parameters to the function signature (line 195-199).

**2b.** After building the `items` array (line 250), add two post-processing blocks:
1. **Day-of-week resolution**: If `tripStartDate` is provided, scan each item for day names ("friday", "saturday", etc.) and compute the corresponding trip day number.
2. **Multi-day expansion**: If an item contains "both days" / "every day" / "all N days", duplicate it into one entry per applicable trip day.

**2c.** Update all callers in `generate-itinerary/index.ts` (lines ~8816, ~9357, ~10100, ~10212, ~12124) to pass `startDate` and `totalDays`.

---

### Layer 3: Chat AI prompt needs stronger temporal mapping instructions

**File:** `supabase/functions/chat-trip-planner/index.ts`

Add to the system prompt (after line 155, before `FAILURE TO EXTRACT`):

- When user says "both days" or "every day", create SEPARATE `userConstraints` entries for each day with explicit `day` numbers.
- When user references a weekday ("Friday night"), calculate which trip day number it maps to from the start date and set `day` accordingly.
- Always set the `day` field when the day can be inferred.

Also update the `mustDoActivities` field description (line 316) to instruct the AI to expand multi-day references into per-day entries (e.g., "US Open 9am-6pm Day 1, US Open 9am-6pm Day 2").

---

### Layer 4: Day 1 arrival uses generic "Airport" instead of actual airport name

**File:** `supabase/functions/generate-itinerary/index.ts`

**4a.** Add `arrivalAirport` to `FlightHotelContextResult` interface (line 2754-2768).

**4b.** In `getFlightHotelContext`, extract `arrivalAirport` from `flightRaw` (already parsed at line 3012) and include it in the return object (line 3239-3253).

**4c.** In the Day 1 constraint templates (lines ~10322, ~10353, ~10383), replace the hardcoded `"Arrival at Airport"` with `"Arrival at ${arrivalAirportDisplay}"` where `arrivalAirportDisplay` is derived from `flightContext.arrivalAirport` (e.g., "LaGuardia Airport (LGA)") falling back to "Airport".

**4d.** In the Stage 2.55 split block (line 9180), replace `const airportN = 'Airport'` with the actual airport name from `flightHotelResult.arrivalAirport`.

---

### Summary

| # | File | Change |
|---|------|--------|
| 1 | `must-do-priorities.ts` L472 | Respect `preferredDay` on Day 1/last day skip guard |
| 2a | `must-do-priorities.ts` L195 | Add `tripStartDate`, `totalDays` params |
| 2b | `must-do-priorities.ts` L250 | Day-of-week resolution + multi-day expansion |
| 2c | `index.ts` (5 call sites) | Pass `startDate` and `totalDays` to `parseMustDoInput` |
| 3 | `chat-trip-planner/index.ts` | Stronger temporal mapping in system prompt |
| 4a-d | `index.ts` | Propagate actual airport name to Day 1 templates |

