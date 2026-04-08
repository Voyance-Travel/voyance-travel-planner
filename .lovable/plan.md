

# Preserve User-Specified Activities in Just Tell Us Flow

## Problem
When users paste a detailed day-by-day itinerary, the system flattens everything into a single `mustDoActivities` string, losing day structure. This causes activities on wrong days, user-specified restaurants being replaced, and non-tourist activities being dropped.

## Changes

### 1. Add `perDayActivities` to chat-trip-planner tool schema
**File: `supabase/functions/chat-trip-planner/index.ts`**

- Add `perDayActivities` field to the `extract_trip_details` tool parameters (after `mustDoActivities`, ~line 356):
  ```typescript
  perDayActivities: {
    type: "array",
    description: "When the user provides a day-by-day plan, extract activities organized BY DAY...",
    items: { type: "object", properties: { dayNumber: { type: "number" }, activities: { type: "string" } }, required: ["dayNumber", "activities"] }
  }
  ```
- Add the "CRITICAL — DAY-LEVEL EXTRACTION" instruction block to the system prompt, inside the existing PRE-PLANNED ITINERARY HANDLING section (~line 171), with all 7 rules about preserving user structure

### 2. Add `perDayActivities` to TripDetails type + metadata persistence
**File: `src/components/planner/TripChatPlanner.tsx`**

- Add `perDayActivities?: Array<{ dayNumber: number; activities: string }>` to the `TripDetails` interface (~line 63)

**File: `src/components/planner/steps/ItineraryPreview.tsx`**

- Add persistence of `data.perDayActivities` to trip metadata alongside `mustDoActivities` (~line 316)

### 3. Use per-day activities in prompt compilation
**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

- At ~line 213, before the existing `mustDoActivitiesRaw` processing, check for `metadata?.perDayActivities`
- If the current `dayNumber` has a matching entry, inject a `USER-SPECIFIED ACTIVITIES FOR THIS DAY (MANDATORY)` prompt section with strict rules (use exact restaurants, don't substitute, fill gaps only)
- If `perDayActivities` has an entry for this day, skip the generic `mustDoActivitiesRaw` parsing for this day — the per-day data is more precise
- Fall through to existing `mustDoActivities` behavior for days without per-day entries or for non-structured inputs

### 4. Protect user-specified venues from hallucination filters
**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

- Before the hallucination filter (~line 888), build a `Set<string>` of user-specified venue names by parsing the current day's `perDayActivities` entry
- Extract names from patterns like "at Jnane Tamsna", "Dinner Comptoir Darna", etc.
- In the filter loop, skip (return `true`) any activity whose name matches a user-specified venue
- Access `perDayActivities` from the trip metadata already available in the function context

### 5. Deploy
- Deploy `chat-trip-planner` and `generate-itinerary` edge functions

## What's NOT changed
- Existing `mustDoActivities` field and all its processing (kept as fallback)
- Existing hallucination filters (still run, just skip user-specified venues)
- Single City, Multi-City, and Build Myself flows (unaffected)
- No database changes needed — `perDayActivities` lives in existing JSONB `metadata` column

