

## Problem Analysis

After tracing the full pipeline, I found three root causes for why user-specified activities like "U.S. Open" get ignored:

### Root Cause 1: No Activity Type Intelligence
`parseMustDoInput()` in `must-do-priorities.ts` only recognizes items from a hardcoded `KNOWN_LANDMARKS` database (Colosseum, Central Park, etc.). Anything not in that list — sporting events, concerts, festivals, conventions — defaults to a generic 120-minute activity with no type classification. The U.S. Open is an all-day event but gets treated like a 2-hour museum visit.

### Root Cause 2: Local Events Intelligence is Disconnected from Must-Dos
Stage 1.9 fetches local events via Perplexity (and correctly finds the U.S. Open), but this data is injected into the prompt with weak "incorporate if relevant" language. Meanwhile, the user's must-do text saying "U.S. Open" goes through a separate path. There is zero cross-referencing — the system never connects "user wants U.S. Open" with "U.S. Open is happening Aug 25-Sep 8."

### Root Cause 3: No Duration-Aware Day Blocking
The scheduling algorithm (`findBestDay`) treats everything as a slottable activity. It doesn't understand that an all-day event like a tennis tournament needs to BE the day — with meals and transit planned around it, not squeezed in alongside 5 other sightseeing stops.

---

## Plan

### 1. Add Event Type Classification to Must-Do Parser
**File:** `supabase/functions/generate-itinerary/must-do-priorities.ts`

Add an `EVENT_PATTERNS` dictionary that recognizes common event types by keyword matching:
- **All-day events** (sporting events, festivals, conventions, theme parks): `us open, wimbledon, super bowl, coachella, comic-con, formula 1, world cup, olympics, disney, universal studios...` → duration 360-480 min, `activityType: 'all_day_event'`
- **Half-day events** (concerts, shows, guided tours): `concert, broadway, show, opera, game...` → duration 180-240 min, `activityType: 'half_day_event'`  
- **Quick stops** (historic sites, viewpoints, photo ops): `statue, monument, bridge, viewpoint...` → duration 30-90 min, `activityType: 'quick_stop'`

Update `parseItem()` to check `EVENT_PATTERNS` before `KNOWN_LANDMARKS`, setting correct `estimatedDuration` and a new `activityType` field on `MustDoPriority`.

### 2. Cross-Reference Must-Dos with Discovered Local Events
**File:** `supabase/functions/generate-itinerary/index.ts` (around line 8420-8435)

After both `localEventsContext` (Stage 1.9) and `mustDoActivities` (Stage 1.999) are available, add a cross-reference step:
- For each parsed must-do item, fuzzy-match against `fetchedLocalEvents` names
- If matched: inherit the event's dates, location, and type; promote to `priority: 'must'`; set `activityType` to `'all_day_event'` or `'half_day_event'` based on event type
- Inject a stronger prompt section: "The user SPECIFICALLY requested [X] AND it is confirmed happening on [dates] at [location]. Dedicate Day N to this event."

### 3. Duration-Aware Day Scheduling
**File:** `supabase/functions/generate-itinerary/must-do-priorities.ts`

Update `findBestDay()` and `buildMustDoPrompt()`:
- If `activityType === 'all_day_event'`: assign the activity to a full day, mark that day as "event day" in the prompt, instruct AI to plan meals/transit around the event venue only
- If `activityType === 'half_day_event'`: block morning or evening, let AI fill the other half
- If `activityType === 'quick_stop'`: inject as "weave into nearest geographically convenient day"

Update the prompt builder to emit type-specific instructions:
```
### 🏟️ ALL-DAY EVENT: U.S. Open (Day 3)
This is an ALL-DAY commitment. Plan Day 3 ENTIRELY around this event:
- Morning: Breakfast near venue, transit to USTA Billie Jean King National Tennis Center
- 10:00-18:00: U.S. Open (main event)
- Evening: Dinner near Flushing/Corona area
- Do NOT schedule other sightseeing on this day
```

### 4. Add "Anything Else" / Additional Notes to Generation Context
**File:** `supabase/functions/generate-itinerary/index.ts`

Check whether `trip.metadata` has an `additionalNotes` or similar field from the planner form. If so, inject it alongside `mustDoActivities` with explicit instructions that free-text trip purpose statements ("this trip is for the U.S. Open") should be treated as must-do anchors.

---

### Summary of Changes
| File | Change |
|------|--------|
| `must-do-priorities.ts` | Add `EVENT_PATTERNS` dictionary, `activityType` field, duration-aware scheduling, type-specific prompt templates |
| `generate-itinerary/index.ts` | Cross-reference must-dos with local events, inject `additionalNotes`, strengthen prompt for matched events |

