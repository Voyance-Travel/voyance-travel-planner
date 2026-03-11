

## Fix: Must-Do Activities Don't Anchor the Schedule

### Problem
Standard must-dos with explicit start times (e.g., "US Open 9am-5pm") lose their time anchoring in the prompt. The `buildMustDoPrompt` function outputs them as just `"US Open → Day 2, morning"` with no hard time constraint, so the AI schedules transfers lazily.

All-day events DO get reverse scheduling (line 764: `Transit to venue ~subtractMinutes(blockedStart, 30)`) but with only a 30-minute buffer — insufficient for most venues.

### Changes

**File: `supabase/functions/generate-itinerary/must-do-priorities.ts`**

**1. Add `calculateLatestDeparture` helper** (near line 715, alongside existing `subtractMinutes`/`addMinutes`):

```typescript
function calculateLatestDeparture(startTime: string, transferMins: number = 60, bufferMins: number = 15): string {
  return subtractMinutes(startTime, transferMins + bufferMins);
}
```

**2. Enhance the standard MUST HAVE prompt section** (lines 796-803) — when a must-do has `explicitStartTime`, emit a hard time anchor block instead of just a title+day line:

For items with explicit times, output:
```
🚨 HARD TIME ANCHOR — DO NOT VIOLATE
**US Open** → Day 2
- MUST arrive by: 09:00 (NON-NEGOTIABLE — traveler has tickets)
- Latest departure from hotel: 07:45 (assumes ~60 min transfer + 15 min buffer)
- All preceding activities MUST end by 07:45
- startTime: "09:00", endTime: "17:00"
- BLOCKED TIME: 09:00–17:00 — no other activities in this window
```

For items without explicit times, keep the current simple format.

**3. Increase the all-day event transit buffer** (line 764-765) from 30 minutes to 60 minutes for the transit-to-venue line, and add a latest-departure constraint:

Change:
```
- Transit to venue ~${subtractMinutes(blockedStart, 30)}
```
To:
```
- Latest departure to venue: ${calculateLatestDeparture(blockedStart)} (NON-NEGOTIABLE)
- Transit to venue: ${subtractMinutes(blockedStart, 60)}–${blockedStart}
```

**4. Apply same logic to half-day events** (lines 776-789) — add reverse-schedule departure time when `explicitStartTime` is present.

### Summary
- One new helper function (~3 lines)
- Enhanced prompt output in 3 sections (all-day, half-day, standard must-dos)
- No structural changes — purely prompt engineering to make time anchors non-negotiable

