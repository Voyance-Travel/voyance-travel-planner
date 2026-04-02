

## Fix: Back-to-Back Transit Cards Sprinkled Without Activities

### Root Cause

The bookend validator in `repair-day.ts` (lines 1200–1350) has an **ordering bug**: the transport consolidation pass (step 0) runs **before** steps 1, 1b, and 2 inject new transport cards. Then step 3 injects even more transit gaps. The result is:

```text
Timeline after all passes:
Activity A → [AI walk] → Activity B → [AI walk] → Lunch →
  [step 1b: Travel to Hotel] → [step 1b: Freshen Up] →
  [step 3: Transit to Activity C] → Activity C →
  [AI walk] → Dinner → [step 2: Travel to Hotel] → [step 2: Return to Hotel]
```

Three sources of transport cards pile up without a final deduplication:
1. **AI-generated** walks/transits between venues
2. **Steps 1/1b/2** inject hotel return + freshen-up transport pairs
3. **Step 3** injects transit gaps between any two non-transport activities at different locations

Step 0 consolidation only catches AI-generated consecutive transports. Steps 1–3 inject more after it runs.

### Fix

**`supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Three changes:

1. **Move consolidation pass to run AFTER step 3** (the final pass, not the first). Rename from "step 0" to "step 4" and place it after the transit gap injection loop. This catches all consecutive transports regardless of source.

2. **Guard step 3 transit gap injection** — Before injecting a transit card between two activities, check if a transport card already exists within ±1 position targeting the same destination. Skip injection if redundant. Also skip injection between accommodation and the next activity if they share the same location name (hotel→hotel freshen-up doesn't need transit).

3. **Add transport→activity destination dedup** — After the final consolidation, scan for patterns where a transport card's destination matches the location of the activity immediately after the next activity (i.e., transport is orphaned between two same-location activities). Remove the redundant transport.

### Detailed Changes

```text
Current order:                    New order:
  0. Consolidate transports         1. Hotel transport → freshen-up
  1. Hotel transport → freshen-up   1b. Mid-day hotel return
  1b. Mid-day hotel return          2. End-of-day hotel return
  2. End-of-day hotel return        3. Transit gap injection (with guards)
  3. Transit gap injection          4. Final consolidation + dedup (moved here)
```

**Step 3 guard logic (new):**
```typescript
// Before injecting transit between curr and next:
// Skip if next activity is at the same location as curr (e.g., hotel activities)
if (cLoc === nLoc) continue;
// Skip if a transport to nLoc already exists in the previous 2 positions
const recentTransport = rebuilt.slice(-2).some(
  a => isTransport(a) && (a.location?.name || '').toLowerCase() === nLoc
);
if (recentTransport) continue;
```

**Final consolidation (step 4):**
- Same logic as current step 0 but runs last
- Additionally removes orphaned transports where `transport.location === nextActivity.location` (transport going nowhere new)

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/pipeline/repair-day.ts` | Move consolidation after all injections; guard step 3 against duplicates; add transport dedup |

