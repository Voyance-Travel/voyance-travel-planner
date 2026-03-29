

# Fix Schema Field Leaks in Descriptions (`,type`)

## Problem
The `TEXT_SCHEMA_LEAK` regex (line 60) requires `[:;|]` after field names, so it catches `,type:value` but misses `,type` at end of string. Fields like `isVoyancePick`, `optionGroup`, `isOption`, `slot` are also not in the alternation.

## Changes

### File: `supabase/functions/generate-itinerary/sanitization.ts`

**1. Update `TEXT_SCHEMA_LEAK` regex (line 60)**
- Add `type|slot|isVoyancePick|optionGroup|isOption` to the field name alternation (some like `type`, `tags`, `bookingRequired` are already present)
- Make the `[:;|]\s*[^,;|]*` suffix optional with `(?:...)?` so it catches bare `,type` at end of string

**2. Add trailing comma-field catch in `sanitizeAITextField` (before line 101's final trim)**
Insert:
```typescript
.replace(/,\s*(?:type|category|slot|isVoyancePick|optionGroup|isOption|tags|bookingRequired)\b[^,.]*/gi, '')
```
This is a safety net for any fields that slip past the main regex.

Two small, targeted edits. No new files, no pipeline changes.

