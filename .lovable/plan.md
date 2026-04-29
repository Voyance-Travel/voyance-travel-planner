## Test suite status

End-to-end run: **280 of 285 tests pass**, across frontend (vitest), the new `user-anchors` tests, and the full `generate-itinerary` edge function suite. All anchor-flow, locking, meal-policy, auth, CORS, multi-city, race-condition, and database trigger tests are green.

Five failures remain. All are pre-existing and unrelated to the user-anchor / universal-locking work. This plan fixes them so the suite goes fully green.

## Failures

**Frontend (1 test file, but 4 string violations):**

`src/test/noEmDashes.test.ts` — guards against em-dashes in user-facing copy. Currently catches:

- `src/components/itinerary/ActivityConciergeSheet.tsx:281` — `{actTitle} — AI Concierge` (sr-only title)
- `src/components/post-trip/ShareTripCard.tsx:238` — share-link helper text
- `src/components/referral/ReferralShareModal.tsx:296` — same copy as above
- `src/pages/ConsumerTripShare.tsx:146` — page `<title>`

**Edge functions (4 tests):**

`supabase/functions/generate-itinerary/sanitization_free_venue_test.ts` — `ALWAYS_FREE_VENUE_PATTERNS` regexes don't match the diacritic/non-Latin forms. The patterns are evidently using ASCII `\b` word boundaries (which don't fire across `é`, `ü`, etc.) or are missing the literal accented character entirely.

Failing inputs:
- `"Église Saint-Sulpice"` → expect match on `église`
- `"Walk on Île Saint-Louis"` → expect match on `île saint-louis`
- `"Alexanderplatz"` → expect match on `platz`
- (German bridge) `"…brücke"` → expect match on `brücke`

## Fixes

### 1. Em-dashes (4 string edits)

Replace `—` with a normal `-` (or restructure to avoid the dash). Matches the project's already-established no-em-dash rule.

| File:line | New text |
|---|---|
| `ActivityConciergeSheet.tsx:281` | `{actTitle} - AI Concierge` |
| `ShareTripCard.tsx:238` | `This link works for everyone - share it with your whole group` |
| `ReferralShareModal.tsx:296` | same as above |
| `ConsumerTripShare.tsx:146` | `` `${trip.name || trip.destination || 'Trip'} - Voyance` `` |

### 2. Free-venue diacritic patterns

In `supabase/functions/generate-itinerary/sanitization.ts`, fix `ALWAYS_FREE_VENUE_PATTERNS` so it matches accented forms:

- For `église`: pattern must contain literal `église` (with accent) and use a Unicode-safe boundary. Use `/(^|[^\p{L}])église([^\p{L}]|$)/iu` instead of `/\béglise\b/i`. The `u` flag plus `\p{L}` letter class is required because `\b` treats `é` as a word-char boundary incorrectly with mixed letters and diacritics.
- For `île saint-louis`: same approach — `/(^|[^\p{L}])île\s+saint-louis([^\p{L}]|$)/iu`.
- For `platz` and `brücke`: these need substring matches because they appear glued onto place names (`Alexanderplatz`, `Oberbaumbrücke`). Patterns: `/platz\b/iu` and `/brücke\b/iu` — drop the leading `\b` so they match inside compounds.

Implementation choice: rewrite each affected entry in the array to use the `u` flag and `\p{L}`-based boundaries. Don't touch entries that are already passing.

### 3. Verify

After edits, re-run the full suite (`bunx vitest run` and the deno test set) and confirm 285/285 green. Then briefly redeploy generate-itinerary so the sanitization fix lands in the live edge function.

## Out of scope

- The `[ANCHOR-TRACE]` live-trip trace is still pending and unaffected by these fixes; we'll run it after.
- No schema changes, no new tests added, no behavior changes to anchor/locking logic.

## Files touched

- `src/components/itinerary/ActivityConciergeSheet.tsx`
- `src/components/post-trip/ShareTripCard.tsx`
- `src/components/referral/ReferralShareModal.tsx`
- `src/pages/ConsumerTripShare.tsx`
- `supabase/functions/generate-itinerary/sanitization.ts`
