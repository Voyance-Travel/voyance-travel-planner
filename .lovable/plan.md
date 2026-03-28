

## Add Missing Sanitization Patterns for Leaked AI Text

### Problem
`sanitizeAITextField` in `sanitization.ts` catches CJK artifacts, schema leaks, and system prefixes but misses several leaked AI planning patterns: reservation urgency codes, next-day planning text, required interest slot references, transport emoji notation, and booking meta.

### Changes

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

1. **Add 7 new regex constants** after line 68 (after `FORWARD_REF_RE`):
   - `RESERVATION_URGENCY_RE` — strips `reservationUrgency: book_now (60 days)` etc.
   - `BOOK_CODE_RE` — strips `book_now via official site` fragments
   - `NEXT_DAY_PLANNING_RE` — strips `Tomorrow: Wake at 08:30...` and `Next morning:...` through end of text
   - `REQUIRED_SLOT_RE` — strips `the required 'Authentic Encounter' interest slot`
   - `TRANSPORT_EMOJI_RE` — strips `🚶 0 min` transport notation
   - `PARENTHETICAL_META_RE` — strips `(Paid activity)` / `(Free to explore...)`
   - `WALKIN_META_RE` — strips `Walk-in OK but busy.`

2. **Add `.replace()` calls** in `sanitizeAITextField` after `FORWARD_REF_RE` and before the existing cleanup chain (empty parens, dash normalization, whitespace collapse).

3. **Also mirror these patterns** in the client-side `src/utils/activityNameSanitizer.ts` `sanitizeActivityText` function for defense-in-depth.

4. **Redeploy** the `generate-itinerary` edge function.

### Technical Detail

All new patterns are purely additive regex replacements — no existing logic changes. The sanitizer is already wired to all user-facing fields (title, name, description, tips, voyanceInsight, bestTime, location) so no additional call-site changes are needed.

