

## Fix: Overly Strict Activity-Keyword Validation Blocking Smart Finish

### Problem

The "User Preference Validation" block (line 2762-2793 in `generate-itinerary/index.ts`) scans the **entire** `preferenceContext` string for keywords like "museum", "skiing", "spa", etc. For Smart Finish trips, this context includes all the user's researched venues and activity titles — so if the user added even one museum to their research, the validator demands **every single non-departure day** include a museum. This causes infinite retry loops and generation failure.

The logic is: "if the word 'museum' appears in preferences → every day MUST have a museum activity." That's wrong. The user mentioning a museum once doesn't mean they want museums every day.

### Fix

Narrow the validation so it only fires when the user **explicitly stated a preference** for an activity type (e.g., "I want to visit museums", "include skiing"), not when the word happens to appear in venue names or research notes.

**File: `supabase/functions/generate-itinerary/index.ts` (~line 2762-2793)**

1. **Scope the keyword check to actual user preference text only** — not the full `preferenceContext` which includes venue lists, research notes, and activity titles. Extract just the user's stated preferences (e.g., `focus: [...]`, `interests: [...]`, trip vibe text) into a separate `userPreferenceText` variable, and check keywords against that narrow string only.

2. **Downgrade from hard failure to warning** — Instead of `validation.isValid = false` (which triggers expensive retries), log a warning. The user's researched venues are already injected as must-do anchors, so the generation will include them naturally.

3. **Make it per-trip, not per-day** — Even for genuine preference keywords, requiring the activity on *every day* is wrong. A user who likes museums doesn't need one daily. At most, validate that the *trip as a whole* includes at least one matching activity (which would be a post-generation check, not per-day).

### Concrete change

Replace the activity keyword validation block with a version that:
- Only checks against `userConstraints` / explicit preference fields (interests, focus, avoid), not the full prompt context
- Warns instead of failing when a keyword appears in general context but not in explicit preferences
- Skips this check entirely for Smart Finish trips (where the user's venues are already hard-anchored)

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Rewrite lines ~2762-2793: narrow keyword source to explicit user preferences only; downgrade to warning for Smart Finish; remove per-day enforcement |

