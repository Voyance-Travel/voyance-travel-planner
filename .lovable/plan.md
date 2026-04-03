

## Fix: Days Must Never Start or End on Transit

### Problem
After all repair steps (transit gap injection, consolidation, dedup), a transport card can end up as the very first or very last activity of a day. A day should always begin and end at the hotel (accommodation card), never on a "Travel to..." card.

### Root Cause
- **End of day**: Step 2 injects "Return to Hotel" based on the last *non-transport* activity, but subsequent steps (transit gap injection in step 3, consolidation in step 4) can append new transport cards after the return.
- **Start of day**: The morning phantom strip (step 0) only removes accommodation phantoms. It doesn't strip leading transport cards that have no logical origin (the traveler wakes up at the hotel, not mid-transit).

### Fix — Two guards at the end of `repairBookends`

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

After the final dedup pass (step 4b, ~line 1756), before returning:

#### 1. Strip leading transport cards (non-departure, non-first-day with pre-check-in transit)
If the first activity in the final list is a transport card:
- On departure days: leave it (could be "Transfer to Airport" as the opener after checkout)
- Otherwise: remove it — the traveler starts at the hotel and doesn't need transit from nowhere
- Exception: if the transport leads to the first real activity and there's no accommodation card before it on Day 1 before check-in, leave it (arrival transfer)

#### 2. Strip or cap trailing transport cards
If the last activity in the final list is a transport card:
- On departure days: leave it (departure transfer is valid as the last card)
- Otherwise: check if it's a "Travel to Hotel" card — if so, append a "Return to Hotel" accommodation card after it
- If it's a transport to somewhere else (not the hotel), remove it — the day can't end mid-transit to a venue

### Expected behavior

| Scenario | Before | After |
|---|---|---|
| Day starts with "Travel to Louvre" | Transit first | Transit removed (traveler is at hotel) |
| Day ends with "Travel to Hotel" | Transit last | "Return to Hotel" card appended |
| Day ends with "Travel to Restaurant" | Transit last | Transit removed (nonsensical) |
| Departure day ends with "Transfer to Airport" | Transit last | Kept (valid departure) |

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add post-consolidation bookend guards

