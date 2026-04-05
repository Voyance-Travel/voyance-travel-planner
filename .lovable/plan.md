

## Fix Garbled Text — Expand Orphaned Preposition Patterns

### Problem
City names are still being dropped in AI output, creating broken text like "to the of Light" and "of the at this boutique spa". The existing regex fix only covers 7 prepositions (`in|over|of|around|across|throughout|from`) and only detects conjunctions (`and|or|but`) as following words.

### Changes

**1. `supabase/functions/generate-itinerary/sanitization.ts`** (lines 185-193) — Expand the orphaned-article regex patterns

Replace the current 5 patterns with expanded versions:

- **Preposition list**: Add `to|for|about|into|toward|towards|through|within|near` (total: 16 prepositions)
- **Pattern 4 following-word list**: Add `at|near|with|by|on|for|where|while|this|that|a|an` (in addition to existing `and|or|but`)
- All 5 patterns updated with the same expanded preposition set

**2. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** (line 828, OUTPUT QUALITY block) — Add city name instruction

Append after the existing OUTPUT QUALITY line:
```
Always use the full destination city name in all text. Never write "the" as a placeholder where the city name should go. For example, write "in the heart of Lisbon" not "in the heart of the". Write "A Goodbye to Lisbon" not "A Goodbye to the".
```

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — expand preposition and following-word lists in 5 regex patterns
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add city name prompt instruction

### No changes to
- No new files
- No architecture changes

