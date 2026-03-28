

## Broad Category-Based Sanitization Regex

### Change — Single file: `supabase/functions/generate-itinerary/sanitization.ts`

**1. Add new broad category patterns after line 77** (after existing leaked AI patterns, before `INLINE_ALT_VENUE_RE`):

- `EMOJI_BOOKING_FLAG_RE` — matches 🔴🟡🟢🔵 + Book/Reserve text
- `URGENCY_PREFIX_RE` — matches any "Urgency:" or "Reservation urgency:" prefixed sentence
- `RAW_CODE_FIELD_RE` — matches camelCase field assignments like `isVoyancePick: true`
- `ALL_CAPS_META_RE` — matches parenthetical all-caps instructions like `(TRANSIT INCLUDED IN TIPS)`
- `AI_SELF_COMMENTARY_RE` — matches "Profile updated for...", "Based on your profile..." sentences
- `ALTERNATIVE_SUGGESTION_RE` — matches "Alternative: X..." sentences
- `STANDALONE_BOOL_RE` — matches standalone `isFieldName: true/false/null` patterns

**2. Update `sanitizeAITextField` (lines 96-102)** — add the new `.replace()` calls after the existing ones, keeping old patterns as additional layers.

**3. Broaden `NEXT_DAY_PLANNING_RE`** (line 73) — current pattern requires a colon after "Tomorrow". Replace with the broader version that catches "Tomorrow" or "Next morning/day" without requiring colon.

**4. Redeploy** the `generate-itinerary` edge function.

Old patterns are kept for backward compatibility — more layers = more coverage.

