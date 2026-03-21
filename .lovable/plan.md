

## Fix: Make Hotel Check-in the First Activity on Arrival Day

### Problem
Currently, when no flight data is provided, the system assumes a conservative 3:00 PM check-in and blocks all morning activities. This ignores reality: travelers arrive with bags and want to drop them off first. Even hotels that officially check in at 3 PM will store luggage — the traveler should head to the hotel immediately, not wait around.

When flight data IS provided, check-in is correctly sequenced after arrival, but the "no flight" paths are overly conservative.

### Changes

**File: `supabase/functions/generate-itinerary/index.ts`**

#### 1. No-flight-but-hotel path (lines ~7899-7935)
Replace the "don't schedule before 15:00" approach with a luggage-drop-first approach:

- Change the first activity from "Hotel Check-in & Settle In" at 15:00 to **"Luggage Drop & Early Check-in"** starting at **10:00 AM**
- Description: "Head to hotel to drop bags. Most hotels store luggage before official check-in; early check-in is often available on request."
- Allow morning activities AFTER the luggage drop (from ~10:30 onwards)
- Add a "Return to Hotel" activity around 15:00-15:30 for official check-in/freshen up if the day is long enough
- Remove the "DO NOT schedule activities before 15:00" instruction

#### 2. No-flight-no-hotel path (lines ~7937-7960+)
Similarly shift from "assume arrival at 3 PM" to a more practical default:

- Assume traveler can start at **10:00 AM** with a flexible meeting point
- Note that without a hotel, we can't plan a luggage drop, but still allow morning activities
- Remove the "DO NOT schedule any morning activities" instruction

#### 3. Prompt rule update (line 1569)
Update the Day 1 arrival structure rule to mention luggage drop as the priority:

```
'12. **DAY 1 ARRIVAL STRUCTURE — CRITICAL**: Day 1 MUST begin with hotel 
check-in/luggage drop as the FIRST activity. Travelers arrive with bags — 
getting to the hotel is the #1 priority. If no flight time is given, assume 
a morning arrival (10:00 AM luggage drop). Do NOT include airport arrival 
or transfer activities — those are handled by a separate UI component.'
```

#### 4. Check-in injection fallback (lines ~6244-6246)
Update the Stage 2.56 injection to default to 10:00 AM instead of 15:00 when no other activities exist, and to 45 minutes before the first activity (minimum 09:00) when activities exist:

```typescript
const firstStartMin_56 = parseTimeToMinutes(firstActivity_56?.startTime || '10:00') || (10 * 60);
const checkInStartMin_56 = Math.max(9 * 60, firstStartMin_56 - 45);
```

### What stays the same
- When flight data IS provided, the existing arrival → customs → transfer → check-in sequence is correct and untouched
- The "Hotel Check-in & Refresh" title and category stay the same
- Multi-city transition check-ins are unchanged
- The check-in description can note "Drop bags / early check-in if available"

### Scope
Single file: `supabase/functions/generate-itinerary/index.ts` — ~40 lines changed across 4 locations. Prompt updates + timing defaults. No frontend changes needed.

