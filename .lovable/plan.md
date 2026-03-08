

## Fix: "Just Tell Us" Chat Planner — Honor User Intent Over System Rules

Four files need changes to capture user intent (flights, full-day events, time-locked activities, preferences) and inject them as highest-priority constraints into itinerary generation.

### File 1: `supabase/functions/chat-trip-planner/index.ts`

**System prompt (after line 49)**: Add "USER INTENT CAPTURE" section instructing the AI to capture full-day events as `userConstraints` with `allDay: true`, flight details in `flightDetails`, specific times in both `mustDoActivities` and `userConstraints`, and preferences/avoids as constraint types.

**Tool description (line 181)**: Change from "Extract structured trip details..." to "Extract ALL trip details from the conversation, capturing every preference, constraint, flight detail, and specific time..."

**Tool schema (after `additionalNotes`, line 243)**: Add two new properties:
- `flightDetails` (string) — verbatim flight info
- `userConstraints` (array of objects) — each with `type` (enum: full_day_event, time_block, avoid, preference, flight), `description`, optional `day`, `time`, `allDay`

### File 2: `src/components/planner/TripChatPlanner.tsx`

**TripDetails interface (line 29-43)**: Add `flightDetails?: string` and `userConstraints?: Array<{type, description, day?, time?, allDay?}>` to the interface. No other changes — fields pass through to `onDetailsExtracted`.

### File 3: `src/pages/Start.tsx`

**Metadata object (lines 2739-2744)**: Add `flightDetails: details.flightDetails || null` and `userConstraints: details.userConstraints || null` to the metadata being inserted into the trips table.

### File 4: `supabase/functions/generate-itinerary/index.ts`

**GenerationContext interface (~line 451)**: Add `userConstraints` and `flightDetails` fields.

**Context building (~line 4183)**: Read `userConstraints` and `flightDetails` from `trip.metadata`.

**New Stage 1.9993 (after line 8520, after generation rules)**: Build `userConstraintPrompt` by iterating `context.userConstraints` and formatting each type:
- `full_day_event` → "ENTIRE day consumed, no other activities"
- `time_block` → "locked to exact time, build around it"
- `avoid` → "do NOT include matching items"
- `preference` → "influences venue selection across ALL days"
- `flight` → "account for arrival/departure + airport transit"

Also build `flightDetailsPrompt` from `context.flightDetails`.

**preferenceContext assembly (line 8572)**: Prepend `userConstraintPrompt + flightDetailsPrompt` at the START of the combined context string (before `generationHierarchy`), so user constraints have highest priority.

**Raw text fallback (line 8483)**: Add rules about honoring full-day events, flight details, specific times, and preferences within the raw mustDoActivities text.

### What stays the same
- `must-do-priorities.ts` parsing logic unchanged
- `TripConfirmCard` display unchanged
- All other edge functions unchanged
- Generation rules system unchanged (user constraints supplement, not replace)
- Response shape from chat planner unchanged (new fields are additive)

