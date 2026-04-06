

## Fix Garbled Venue Names (Word Substitution Variant)

### Problem
AI sometimes substitutes proper nouns with phonetically similar English words in `venue_name` fields (e.g., "Alfama" → "Alphabetical"). The activity title is correct, but `venue_name` is garbled.

### Plan (2 files)

**File 1: `supabase/functions/generate-itinerary/sanitization.ts`**

Add two functions and wire them into the existing per-activity sanitization loop (around line 317, after `cleanVenueNameMealLeakage`):

1. **`validateVenueNameConsistency(title, venueName)`** — Cross-validates venue_name against the activity title. Extracts location names from title patterns like "through X District", "in X", "at X" and checks if venue_name references a district/walk/stroll but uses a different word. If mismatch found, replaces the garbled word with the title's location. Logs `GARBLED VENUE NAME FIX`.

2. **`detectGarbledVenueWords(venueName)`** — Checks venue_name against a list of known garbled words that should never appear in venue names: `Alphabetical`, `Sequential`, `Numerical`, `Categorical`, `Grammatical`, `Chronological`, `Geographical`, `Metaphorical`, `Hypothetical`. If detected and not fixable from title, logs `GARBLED VENUE WORD DETECTED` and falls back to the activity title as venue_name.

Wire into existing loop at line ~317:
```typescript
if (act.venue_name) {
  act.venue_name = cleanVenueNameMealLeakage(act.venue_name);
  act.venue_name = validateVenueNameConsistency(act.title, act.venue_name);
  if (detectGarbledVenueWords(act.venue_name)) {
    // Fall back to a cleaned version derived from the title
    act.venue_name = extractLocationFromTitle(act.title) || act.venue_name;
  }
}
```

**File 2: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

Add a venue name rule to the system prompt (alongside existing rules):
```
VENUE NAME RULES:
- venue_name must be a real place name, not a descriptive phrase.
- NEVER substitute proper nouns with English adjectives (Alphabetical, Sequential, Historical).
- venue_name should match the location referenced in the activity title.
```

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — add venue name consistency check + garbled word detection
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add venue name prompt rule

