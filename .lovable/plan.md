

## Unify Chat Path to Match Form Path Output

### Problem Summary
The "Just Tell Us" chat path writes 6 fewer metadata fields than the form path, and its `mustDoActivities` is a string instead of `string[]`. This means chat-sourced trips generate with zero personalization context (no pacing, no interest categories, no generation rules, no first-time-visitor flag, no celebration day).

### Changes

#### 1. Expand `extract_trip_details` tool schema (Edge Function)
**File: `supabase/functions/chat-trip-planner/index.ts`**

Add these properties to the tool's `parameters.properties`:
- `pacing` — enum `["relaxed", "balanced", "packed"]`. Description: infer from conversation (e.g. "slow pace" → relaxed, "pack it in" → packed). Default intent: balanced.
- `isFirstTimeVisitor` — boolean. Description: true if user hasn't visited before or doesn't mention prior visits.
- `interestCategories` — array of strings, enum values `["history", "food", "shopping", "nature", "culture", "nightlife"]`. Description: infer from conversation topics.
- `celebrationDay` — number (day number). Description: if trip is for a birthday/anniversary, which day the celebration falls on.

Update the system prompt's extraction quality section to instruct the AI to infer these fields from context (e.g. "we love food and nightlife" → `interestCategories: ["food", "nightlife"]`; "never been to Rome" → `isFirstTimeVisitor: true`; "want a relaxed trip" → `pacing: "relaxed"`).

#### 2. Expand `TripDetails` interface
**File: `src/components/planner/TripChatPlanner.tsx`**

Add to the `TripDetails` interface:
- `pacing?: 'relaxed' | 'balanced' | 'packed'`
- `isFirstTimeVisitor?: boolean`
- `interestCategories?: string[]`
- `celebrationDay?: number`

#### 3. Normalize chat metadata in `Start.tsx`
**File: `src/pages/Start.tsx` (lines ~2793-2800)**

Update the chat path's `metadata` object to match the form path structure:

```
metadata: {
  // Normalize mustDoActivities to string[] (form format)
  mustDoActivities: details.mustDoActivities
    ? details.mustDoActivities.split(',').map(s => s.trim()).filter(Boolean)
    : null,
  additionalNotes: details.additionalNotes || null,
  flightDetails: details.flightDetails || null,
  userConstraints: details.userConstraints || null,
  // NEW — these 5 fields were missing from chat path
  pacing: details.pacing || 'balanced',
  isFirstTimeVisitor: details.isFirstTimeVisitor ?? true,
  interestCategories: details.interestCategories?.length ? details.interestCategories : null,
  celebrationDay: details.celebrationDay || null,
  generationRules: null, // Chat doesn't collect structured rules
  source: 'chat_planner',
  lastUpdated: new Date().toISOString(),
}
```

#### 4. Add `generationRules` extraction from `userConstraints`
**File: `src/pages/Start.tsx`** (in the chat details handler)

Convert `details.userConstraints` into `generationRules` format where applicable:
- `type: "full_day_event"` with `allDay: true` → generation rule `{ type: 'blocked_time', days: ['day_N'], from: '00:00', to: '23:59', reason: description }`
- `type: "time_block"` → generation rule with specific time
- `type: "avoid"` → kept as additional notes context

This ensures userConstraints (which the generation engine doesn't read directly) are translated into generationRules (which it does read).

### What's NOT Changing
- The generation engine (`generate-itinerary/index.ts`) — it already reads all these metadata fields
- The form path's trip creation logic
- The `itineraryAPI.ts` mustDoActivities handling (it already handles both string and string[] via `Array.isArray()` check)
- Multi-city routing, flight/hotel persistence, trip_cities insertion

### Files Touched
1. `supabase/functions/chat-trip-planner/index.ts` — 4 new tool properties + system prompt update
2. `src/components/planner/TripChatPlanner.tsx` — 4 new TripDetails fields
3. `src/pages/Start.tsx` — expanded metadata object + userConstraints→generationRules conversion

