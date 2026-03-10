

## Fix: Hotel Check-in Missing on All-Day Event Days

### Problem
Two issues combine to eliminate the hotel check-in on all-day event days:

1. **Backend**: The all-day event template (index.ts ~line 6994) lists post-event activities as a vague bullet list ("After the event ends, add: transfer, check-in, dinner"). Items 1-3 are structured with startTime/category/description and the AI reliably generates them. Item 4 is treated as optional and often skipped.

2. **Frontend**: `injectHotelActivities.ts` strips ANY accommodation-category activity with "check-in" in the title (line 99-103), then injects a deterministic check-in at the hotel's `checkInTime` (default 3 PM). On event days the traveler is at the venue at 3 PM, so the injected check-in lands mid-event chronologically.

### Plan

**File 1: `supabase/functions/generate-itinerary/index.ts` (~lines 6994-7003)**

Replace the vague bullet list (item 4) with structured required activities matching the format of items 1-3:

```
4. "Transfer to ${flightContext.hotelName || 'Hotel'}"
   - startTime: after the event ends (estimate based on event duration)
   - category: "transit"
   - description: "Head to the hotel after the event"

5. "Hotel Check-in"
   - startTime: 30 minutes after transfer starts
   - category: "accommodation"
   - description: "Late check-in after a full day at ${eventName}. Drop bags, freshen up."
   - location: { name: "${flightContext.hotelName || 'Hotel'}", address: "${flightContext.hotelAddress || ''}" }
   - THIS IS REQUIRED. Do NOT skip this activity.

6. Dinner (if time permits — only add if check-in ends before 21:30)

⚠️ IMPORTANT CONSTRAINTS:
- The traveler CHOSE to go directly to the event. Respect this choice.
- Do NOT add a hotel check-in BEFORE the event.
- Do NOT generate a separate "Airport Transfer to Hotel" activity before the event.
- Activities 4 and 5 (transfer + check-in) are MANDATORY after the event.
```

**File 2: `src/utils/injectHotelActivities.ts` (~lines 93-107)**

Update `stripExistingHotelActivities` to preserve AI-generated late check-ins on event days. Add a tag-based exemption: if an activity has a `late-checkin` tag or its `startTime` is after 17:00, skip the stripping. Then update `injectHotelActivitiesIntoDays` to skip injecting a deterministic check-in on days that already have a preserved late check-in activity.

Alternatively (simpler approach): since the backend now reliably generates a structured check-in with the correct late time, we can tag it with `'late-checkin'` in the prompt and exempt tagged activities from stripping. The frontend injection would check: "does this day already have an accommodation check-in activity after 17:00?" — if yes, skip injecting the default 3 PM one.

### Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Replace vague post-event bullets with structured required activities 4-6 |
| `src/utils/injectHotelActivities.ts` | Skip stripping/re-injecting check-in when a late check-in (after 17:00) already exists |

