

## Fix Arrival Day Hotel Sequence

### Problem
On arrival day (Day 1), the itinerary shows an impossible sequence:
1. 12:00 AM — "Return to Hotel" (you haven't been there yet)
2. Breakfast at Hotel (you haven't checked in yet)
3. Check-in at Hotel (should be FIRST)

Two bugs in `repair-day.ts` cause this:

**Bug 1 — Check-in detection is too broad (line 530-537)**
The `hasCheckIn` check matches ANY accommodation activity with "hotel" in the title. If the AI generates "Return to Hotel" or "Breakfast at Hotel", the repair thinks check-in already exists and skips injecting it.

**Bug 2 — Bookends lack arrival-day awareness (line 1287-1297)**
The end-of-day "Return to Hotel" injection has `isDepartureDay` guards but NO `isFirstDay` guard. On Day 1, it injects "Return to Hotel" even though the traveler hasn't arrived yet. Same issue with the mid-day hotel return (line 1267-1285).

### Changes

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

1. **Fix check-in detection (step 7, ~line 530-537)**: Tighten `hasCheckIn` to ONLY match activities with explicit check-in keywords (`check-in`, `check in`, `checkin`, `luggage drop`, `settle in`). Remove the broad `t.includes('hotel')` match that causes false positives from "Return to Hotel" or "Breakfast at Hotel".

2. **Add arrival-day guard to bookends (step 9, ~line 1267-1297)**:
   - Pass `isFirstDay` into `repairBookends`
   - On Day 1, skip injecting "Return to Hotel" at the END of day if the last activity is BEFORE the check-in time (the traveler may still be exploring pre-check-in)
   - On Day 1, skip injecting mid-day hotel return if it would be placed BEFORE any check-in activity — you can't "return" to a place you haven't been yet

3. **Enforce check-in-first ordering on Day 1 (step 7, ~line 568)**: After injecting check-in, remove any accommodation activities (Return to Hotel, Freshen Up) that are scheduled BEFORE the check-in time. These are logically impossible on arrival day.

4. **Strip pre-check-in hotel meals on Day 1**: If "Breakfast at Hotel" appears before check-in, relabel it to just "Breakfast" (remove hotel reference) or move it after check-in. The traveler can eat at a café before checking in, but not at a hotel they haven't arrived at.

### Expected Result
Arrival day sequence becomes: Arrive → Check-in at Hotel → Explore → (optional Freshen Up) → Dinner → Return to Hotel

