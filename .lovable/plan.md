

## Fix: Remove "Airport Transfer to Hotel" from 3 Hardcoded Arrival Sequences

### What's already done
- Main prompt instruction (line 4958): Already says TWO blocks, no transfer -- done in previous fix
- Combined-block splitter (lines 9148-9210): Already splits into 2 blocks -- done
- `prompt-library.ts` seqLabels: Already has no `airport_transfer` -- done

### What remains
The 3 hardcoded REQUIRED ACTIVITY SEQUENCE blocks still list "Airport Transfer to Hotel" as item #2:

**File:** `supabase/functions/generate-itinerary/index.ts`

#### Morning arrival (~lines 10321-10346)
Remove "Airport Transfer to Hotel" block (lines 10328-10331), renumber "Hotel Check-in & Refresh" to #2, add hotel location, update guidelines reference from "3 arrival activities" to "2 arrival activities".

#### Afternoon arrival (~lines 10354-10378)
Remove "Airport Transfer to Hotel" block (lines 10361-10364), renumber "Hotel Check-in" to #2, update guidelines.

#### Evening arrival (~lines 10386-10409)
Remove "Airport Transfer to Hotel" block (lines 10392-10395), renumber "Hotel Check-in" to #2, update "3 arrival activities" to "2 arrival activities" in evening guidelines (line 10403).

Each section changes from a 3-step sequence to a 2-step sequence: Arrival at Airport → Hotel Check-in. The transfer gap is implicit (covered by the ArrivalGamePlan UI widget).

### Files changed
| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Remove "Airport Transfer to Hotel" from 3 arrival sequence blocks |

Edge function will need redeployment.

