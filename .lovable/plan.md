

## Fix: Hotel Change Day — Direct Transit + Earlier Check-in

### Problem
On hotel-change days, the repair pipeline injects a Checkout from Hotel A (11:00) and a Check-in at Hotel B (15:00), but:
1. **No transport card** is injected between checkout and check-in — the traveler "teleports" between hotels
2. **Check-in is too late** — defaults to 15:00 even though the traveler should go directly to Hotel B after checkout (~30 min travel + arrival)

### Root Cause
The split-stay block (step 7/8 in `repair-day.ts`, lines 649-726) injects checkout and check-in activities but never injects a transport card between them. The main transit gap pass (step 3) runs *before* step 7/8, and the post-dedup pass (9d) only runs if step 9c actually removes something.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

In the `isHotelChange` block (lines 649-726), after injecting both checkout and check-in:

1. **Inject a transport card** between checkout and check-in: "Travel to {Hotel B}" with `fromLocation: Hotel A` and `location: Hotel B`. Use coordinate-based duration if available, otherwise default 30 min.

2. **Set check-in time based on checkout + travel**: Instead of `Math.max(15*60, checkoutEnd+30)`, calculate as `checkoutEnd + transportDuration + 15` (15 min buffer for arrival/lobby). This makes the day feel natural — checkout at 11:00, travel 30 min, arrive and check in ~11:45.

3. **Sequence**: Checkout (11:00-11:30) → Travel to Hotel B (11:30-12:00) → Check-in at Hotel B (12:00-12:30)

### Expected Behavior
- Hotel change days show: Checkout → Travel to new hotel → Check-in
- Timing flows naturally from checkout through travel to check-in
- No "teleportation" gap between hotels

### Files Changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add transport injection + adjust check-in timing in split-stay block

