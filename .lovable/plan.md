

## Fix: Orphaned Transport Cards (Travel to → Travel back with no activity)

### Problem

The repair-day pipeline produces orphaned transport card sequences where two consecutive transport cards appear with no real activity between them. In this case:

```text
Freshen Up at Your Hotel (20:15-20:45)   ← accommodation
Travel to Le Moulin de la Galette (20:45-21:00)  ← transport
Travel to Your Hotel (22:00-22:15)        ← transport  
Return to Your Hotel (22:20-22:35)        ← accommodation
```

The user sees transit badges but no activity card between them. The dinner card at Le Moulin exists earlier in the day (19:15-20:15) but is placed BEFORE the Freshen Up, not between these transits.

### Root Cause

The existing transport validator (repair-day.ts, ~line 2933) rewrites transport destinations to match neighbors, but never detects or removes **consecutive transport pairs that cancel out** (Travel to X → Travel back from X). This creates ghost transit rows visible in the UI.

### Fix

Add a new post-processing pass in `repair-day.ts` after the transport validation (Step 9, after bookends):

**Remove consecutive transport pairs that round-trip without an intervening activity.**

```text
// Pseudocode:
for each consecutive transport pair [A, B]:
  if A goes TO location X and B goes BACK from X (or to hotel):
    remove both A and B
```

### File Changes

**`supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

After the existing "9c. BACK-TO-BACK ACCOMMODATION DEDUP" pass (~line 1889), add a new **"9e. ORPHANED ROUND-TRIP TRANSPORT REMOVAL"** pass:

- Scan for consecutive transport cards where:
  1. The first transport's destination matches the second transport's origin (or the second goes to hotel/back)
  2. There is NO non-transport activity between them
- Remove both transport cards when this pattern is found
- Log the removal as a repair action

### What This Does NOT Change
- The dinner card rendering — it exists and renders correctly at 7:15 PM (above the viewport in the screenshot)
- The cross-day dedup logic — dining is already exempt
- Any frontend rendering logic

### Deployment
Redeploy `generate-itinerary` edge function.

