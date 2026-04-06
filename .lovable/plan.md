

## Fix "Lunch at a bistro" Placeholder — Expand Generic Venue Detection

### Root Cause

The existing `GENERIC_VENUE_PATTERNS` in `validate-day.ts` (line 39) only catches `at a local spot|nearby spot|restaurant` but misses `at a bistro`, `at a café`, `at a nice place`, etc. The title "Lunch at a bistro" slips through validation, so `repair-day.ts` never fires its GENERIC_VENUE replacement logic.

The validate+repair pipeline already handles this bug category — it just needs wider pattern coverage.

### Plan (2 files)

**File 1: `supabase/functions/generate-itinerary/pipeline/validate-day.ts`**

Expand `GENERIC_VENUE_PATTERNS` (line 39) to catch more generic meal titles:

```
// Current (line 39):
/^(breakfast|brunch|lunch|dinner)\s+at\s+a\s+(local\s+spot|nearby\s+spot|restaurant)/i,

// Replace with broader pattern:
/^(breakfast|brunch|lunch|dinner|supper|meal)\s+at\s+(a|an|the)\s+/i,
```

This catches "Lunch at a bistro", "Dinner at a café", "Breakfast at a nice place", etc. — any meal title using an article instead of a proper noun is a placeholder.

**File 2: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

Add "a bistro" and "a nice place" to the BANNED phrases in the existing RESTAURANT NAMING RULES section (~line 821) to reduce AI generation of these placeholders in the first place.

### Files to edit
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — broaden generic venue regex to catch all "Meal at a [descriptor]" patterns
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add more banned placeholder phrases to prompt

### Verification
Generate a 4-day Lisbon trip. Every dining activity should have a real restaurant name. Check edge function logs for GENERIC_VENUE repair entries to confirm the detection fires if the AI still generates placeholders.

