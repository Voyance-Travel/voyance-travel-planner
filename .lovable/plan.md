

# Two Paths, One Parser — Full Implementation Plan

## Confirmed Design Decisions

| Decision | Resolution |
|----------|-----------|
| Either/Or options | Radio-style "Choose one:" groups via `optionGroup` field |
| Currency | Display as-parsed, no conversion |
| Preferences vs DNA | Keep separate (Option A), merge only at generation time |
| Validation | Editable chips before save, "Save to profile" checkbox |
| Conflicts | Explicit prompt preferences override DNA per-trip only |

## New Files to Create

### 1. `supabase/functions/parse-trip-input/index.ts`

Edge function using Gemini Flash with tool calling for structured extraction.

- Accepts `{ text: string }` body
- System prompt instructs the model to:
  - Detect prompt vs output sections (looks for "I want...", "Build me...", separators)
  - Extract preferences from prompt section (budget, dietary, pace, avoids, walkability)
  - Extract itinerary from output section (days, activities, times, costs, options)
  - Handle tables, bullets, prose, mixed formats, emoji formatting
  - Map custom column headers dynamically ("Vibe" to notes, "Where" to location)
  - Detect either/or options and assign shared `optionGroup` IDs
  - Capture accommodation notes and practical tips as separate arrays
- Tool-calling schema defines `extract_trip_data` function with full `ParsedTripInput` shape including `ParsedPreferences`
- Returns structured JSON with `preferences` (nullable) + itinerary data
- Handles 429/402 errors from Lovable AI gateway
- No auth required (free operation)
- Cost: ~$0.005-0.03 per paste depending on complexity
- Register in `supabase/config.toml`

### 2. `src/types/parsedTrip.ts`

TypeScript interfaces:

```text
ParsedPreferences {
  budget?: string
  budgetLevel?: "budget" | "mid-range" | "luxury"
  focus?: string[]
  avoid?: string[]
  dietary?: string[]
  walkability?: string
  pace?: string
  accessibility?: string[]
  rawPreferenceText?: string
}

ParsedTripInput {
  preferences?: ParsedPreferences
  destination?: string
  dates?: { start: string, end: string }
  duration?: number
  travelers?: number
  tripType?: string
  days: ParsedDay[]
  accommodationNotes?: string[]
  practicalTips?: string[]
  unparsed?: string[]
}

ParsedDay {
  dayNumber: number
  date?: string
  theme?: string
  dailyBudget?: number
  activities: ParsedActivity[]
}

ParsedActivity {
  name: string
  time?: string
  location?: string
  cost?: number
  currency?: string
  notes?: string
  description?: string
  category?: string
  isOption?: boolean
  optionGroup?: string
  bookingRequired?: boolean
  source: 'parsed'
}
```

### 3. `src/components/planner/ManualTripPasteEntry.tsx`

New component for the "I'll Build Myself" tab:

- Large textarea with placeholder showing example paste format
- "Organize My Research" button
- Calls `parse-trip-input` edge function
- Loading state during parsing
- **Preference review step** (when preferences detected):
  - Shows extracted values as editable chips/tags
  - "Save to my profile for future trips" checkbox
  - User can edit/remove any extracted preference
- **Itinerary preview** showing parsed days and activity count
- On confirm: creates trip in DB with `manual_builder` flag, redirects to itinerary view
- No credit check, no auth gate (but saving preferences requires auth)

### 4. `src/utils/createTripFromParsed.ts`

Utility to convert `ParsedTripInput` to the existing trip/itinerary_data format:

- Maps `ParsedDay[]` to the `itinerary_data.days` JSONB structure
- Handles either/or options: first option becomes primary, alternatives stored in activity metadata as `alternativeOptions`
- Sets `[Add address]` placeholders for missing locations
- Sets `source: 'parsed'` on all activities
- Stores `accommodationNotes` and `practicalTips` in `itinerary_data` metadata
- Creates trip record via existing Supabase insert flow
- Enables manual builder mode via Zustand store

## Files to Modify

### 5. `src/pages/Start.tsx`

- Add 4th tab button: "I'll Build Myself" with `PenLine` icon
- `planMode` type changes from `'single' | 'multi' | 'chat'` to `'single' | 'multi' | 'chat' | 'manual'`
- When `planMode === 'manual'`, render `ManualTripPasteEntry` component
- Hide the form fields (destination, dates, etc.) in manual mode — the parser extracts them

### 6. `src/components/itinerary/EditorialItinerary.tsx`

- Detect activities with `isOption: true` and matching `optionGroup`
- Render grouped options as radio-style selection blocks:
  ```text
  Dinner -- Choose one:
  ( ) Uchi (elevated)
  ( ) Loro (casual but excellent)
  ```
- When user selects an option, update the activity in state (selected becomes primary)
- Show `accommodationNotes` and `practicalTips` (from `itinerary_data` metadata) in collapsible sections at the bottom of the itinerary for manually parsed trips
- Smart Finish banner already shows for manual mode trips -- verify it works with this new entry path

### 7. `supabase/config.toml`

Register the new `parse-trip-input` function with `verify_jwt = false` (free, no auth required).

## No Database Changes

Existing infrastructure covers everything:
- `trips` table with `itinerary_data` JSONB handles the parsed scaffold
- `user_preferences` table stores extracted preferences (if user opts to save)
- `manual_builder` tracked client-side in Zustand persist store
- `smart_finish_purchased` flag already exists on trips

## Implementation Sequence

```text
Step 1: Create types (parsedTrip.ts)
Step 2: Create edge function (parse-trip-input) + deploy
Step 3: Create utility (createTripFromParsed.ts)
Step 4: Create ManualTripPasteEntry component
Step 5: Add 4th tab to Start.tsx
Step 6: Update EditorialItinerary for option groups + notes sections
Step 7: Test end-to-end with the Austin example paste
```

## Cost Model

| Operation | Cost | Paid By |
|-----------|------|---------|
| Parse paste input | ~$0.005-0.03 | Free (absorbed) |
| View organized itinerary | $0 | Free |
| Smart Finish enrichment | $6.99 | User |
| Full AI build (Just Tell Us) | Credits | User |

