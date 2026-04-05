

## Fix Garbled City Name — Broader Pattern Matching

### Problem
Two new garbled text variants slipped through the existing orphaned-article fix:
1. **"Arrival in the of Seven Hills"** — "the" followed by preposition "of" (not in the current following-word list)
2. **"sweeping views of the illuminated."** — "the [adjective]." where the city name was stripped, leaving a dangling adjective

### Changes

**File: `supabase/functions/generate-itinerary/sanitization.ts`** (~lines 180-194)

Expand the orphaned-article replacement block inside `sanitizeAITextField`:

- **Rule 2 expansion**: Add prepositions (`in`, `to`, `of`, `over`, `for`, `about`, `around`, `across`, `throughout`, `from`, `into`, `toward`, `towards`, `through`, `within`, `near`) to the "following word" list in line 191, so "the of", "the in", "the to" etc. are all caught.
- **Rule 6 (new)**: Catch "the [adjective]." — adjectives ending in `-ed`, `-ful`, `-ous`, `-ic`, `-al`, `-ive`, `-ant`, `-ent` followed by a period. Replace with `destination`'s `[adjective] landscape.`
- **Rule 7 (new)**: Catch the specific "in the of" title pattern → replace with `in [destination], the City of`
- **Rule 3 expansion**: Add `!` and `?` sentence-end variants (currently only `.` is handled)

**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** (~line 839)

Strengthen the existing city name instruction to add:
```
CRITICAL: Always use the ACTUAL city name in descriptions. Never use placeholder text like "the city" or generic references. Write "Lisbon" (or whatever the destination is) every time you reference the destination city. Do not use "the" as a substitute for the city name.
```

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — expand orphaned-article regex block
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — strengthen city name prompt rule

### Verification
Generate a Lisbon trip. Search all day titles and descriptions for: "the of", "the.", "the,", "the [adjective]." — none should appear.

