

# Fix: Must-Haves Not Respected During Itinerary Generation

## Problem

When users add "must-haves" (schedule constraints like "not available until 3pm", specific hotel requirements, family members arriving on certain days), the itinerary generation engine **completely ignores them**. The generated itinerary fills every day with activities as if no constraints exist.

## Root Cause

There are **two separate must-have systems** that are not connected:

1. **Must-Haves Checklist** (`mustHavesAPI.ts`) -- Stores structured items in `trip.metadata.mustHaves` as an array of objects with labels and notes. This is what users interact with to add their constraints.

2. **Must-Do Activities** (`mustDoActivities`) -- Stored in `trip.metadata.mustDoActivities` as a plain text string. This is the **only** input the generation engine reads.

The generation engine (`generate-itinerary/index.ts`) reads `metadata.mustDoActivities` at lines 4108 and 9266, but **never reads `metadata.mustHaves`**. The must-haves checklist is essentially a dead-end — data goes in but never influences generation.

Additionally, the `must-do-priorities.ts` parser is designed for **venue/activity names** (like "Visit the Colosseum"). It does not understand **schedule constraints** ("not available until 3pm"), **logistics** ("family member arriving Day 3"), or **hotel preferences** ("must stay at Hotel X"). These types of must-haves get stripped or misinterpreted by the parsing logic.

## Fix (Two Parts)

### Part 1: Bridge Must-Haves into Generation Context

**File: `supabase/functions/generate-itinerary/index.ts`**

At both generation entry points (full trip generation ~line 4108, and per-day generation ~line 9266), read `metadata.mustHaves` and convert the checklist items into a structured prompt section that gets injected alongside `mustDoActivities`.

```text
// Pseudocode for the bridge:
1. Read metadata.mustHaves array from trip
2. If items exist, build a prompt section:
   "## TRAVELER'S NON-NEGOTIABLE REQUIREMENTS
    The traveler has specified these constraints. They MUST be respected:
    - [label]: [notes]
    - ..."
3. Inject this prompt into the generation context
```

### Part 2: Add Constraint-Aware Prompt Injection

**File: `supabase/functions/generate-itinerary/index.ts`**

The must-haves often contain **schedule constraints**, not just venue names. The prompt injection needs to handle both types:

- **Venue-type must-haves** (e.g., "Stay at Riad Yasmine"): Feed into the existing must-do-priorities parser
- **Constraint-type must-haves** (e.g., "Not available until 3pm", "Family arrives Day 3"): Inject as **hard scheduling rules** in a separate prompt section that the AI must respect

The new prompt section will be structured as:

```text
## HARD SCHEDULING CONSTRAINTS (NON-NEGOTIABLE)
These are the traveler's personal constraints that override default scheduling:
- "School trip - not available until after 3:00 PM on weekdays" 
  -> Do NOT schedule any activities before 15:00 on these days
- "Family member joining on Day 3"
  -> Adjust group size and activity selection from Day 3 onward
- "Must stay at [Hotel Name]"
  -> Use this as the geographic anchor for all days

VIOLATION OF ANY CONSTRAINT = ITINERARY REJECTION
```

### Part 3: Full-Trip Generation Entry Point

**File: `supabase/functions/generate-itinerary/index.ts` (~line 4108)**

Add after the existing `mustDoActivities` loading:

```typescript
// Also load structured must-haves checklist from metadata
const mustHavesList = (trip.metadata?.mustHaves as Array<{label: string; notes?: string}>) || [];
```

Then merge these into the prompt alongside `mustDoActivities`.

### Part 4: Per-Day Generation Entry Point

**File: `supabase/functions/generate-itinerary/index.ts` (~line 9266)**

Same pattern — read `metadata.mustHaves` and inject into the day-specific prompt.

## Technical Details

### Files to Modify

1. **`supabase/functions/generate-itinerary/index.ts`** (2 locations)
   - Full-trip generation context builder (~line 4106-4116): Add `mustHaves` array reading
   - Per-day generation (~line 9257-9291): Add `mustHaves` reading and prompt injection
   - Both locations: Build and inject constraint prompt section

2. **`supabase/functions/generate-itinerary/must-do-priorities.ts`**
   - Add a new export function `buildMustHavesConstraintPrompt(mustHaves)` that categorizes each must-have as either a venue anchor or a scheduling constraint, and builds appropriate prompt text for each

### How It Works After the Fix

1. User adds must-have: "Not available until 3pm - school trip"
2. Stored in `metadata.mustHaves[].label` + `.notes`
3. Generation reads both `mustDoActivities` AND `mustHaves`
4. The new `buildMustHavesConstraintPrompt()` function classifies each item:
   - Contains time references ("until 3pm", "after 3") -> scheduling constraint
   - Contains hotel/accommodation keywords -> geographic anchor
   - Contains person references ("family arriving") -> group logistics
   - Otherwise -> treated as venue/activity must-do
5. Each category gets its own prompt section with appropriate enforcement language
6. The AI receives clear, categorized constraints it cannot ignore

