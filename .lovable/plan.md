# Fix: Istanbul "Partial" badge from descriptive must-do phrases

## Root cause (confirmed)

`assertMustDoCoverage` in the chain-finalization hard gate (action-generate-trip-day.ts L4234-4248) receives every entry returned by `extractMustDoVenues`. Descriptive experience phrases like *"Watch the sunset from a rooftop overlooking the Bosphorus"* have no venue identity to match against, so coverage always reports them as missing → `isComplete=false` → `itinerary_status='partial'` persisted, regardless of how well the trip actually fulfills the wish.

The injector and gate are correct for real venues ("Hagia Sophia", "Trevi Fountain"). The bug is upstream — the extractor doesn't distinguish a **venue** from an **experience**.

## Fix

Single-file change in `supabase/functions/_shared/extract-must-dos.ts`:

1. Add an `isExperiencePhrase(s)` classifier. True when the string:
   - starts with or contains an experience verb: `watch|see|experience|enjoy|try|catch|witness|explore|wander|stroll|relax|unwind|hunt|sample|taste|attend|listen`, OR
   - contains an experience noun without any Capitalized proper-noun token: `sunset|sunrise|view|vibes|atmosphere|nightlife|rooftop|beach day|day trip|hidden gem|local life`, OR
   - is >7 words AND has zero capitalized proper-noun tokens (after stripping leading "Day N:").
2. In `extractMustDoVenues`, when an entry is an experience phrase, **skip it from the returned venue list** (so the coverage gate ignores it) but expose the phrase via a new sibling export `extractMustDoExperiences(metadata)` that returns the bucketed `string[]` of descriptive wishes.
3. Refactor `extractMustDoVenues` internals into a shared `splitMustDoEntries(metadata)` so both extractors read the same canonical entries (no logic drift).

## Downstream usage

- The hard gate (`action-generate-trip-day.ts` L4234-4248), pre-injection extraction (L4081), and `action-save-itinerary` coverage restamp already only need real venues — no call-site changes required, they keep using `extractMustDoVenues` and silently stop blocking on experiences.
- The day-1 prompt context site (L523-534) already prints these as user wishes via the preference spine; experiences will continue to be conveyed through `trip_day_intents` + USER WISHES prompt block (no regression — soft guidance, not hard coverage).
- No frontend change. No DB change. No backfill needed — next save / next generation flips Istanbul-class trips to `ready`.

## Tests

Extend `supabase/functions/_shared/__tests__/assert-must-do-coverage.cities.test.ts` (or a new `extract-must-dos.test.ts`) with:

- `"Watch the sunset from a rooftop overlooking the Bosphorus"` → `extractMustDoVenues` returns `[]`, `extractMustDoExperiences` returns the phrase.
- `"Hagia Sophia"` → venues=[`Hagia Sophia`], experiences=[].
- Mixed `"Hagia Sophia, Watch the sunset over the Bosphorus"` → venues=[`Hagia Sophia`], experiences=[`Watch the sunset…`].
- Edge: `"Trevi Fountain at sunset"` → still classified as venue (proper noun present).
- Existing Rome/Mexico City/Istanbul/Buenos Aires coverage tests continue to pass unchanged.

## Memory update

Append to `mem://constraints/itinerary/must-do-coverage-injection.md`:
- Note that `extractMustDoVenues` excludes descriptive experience phrases; gate operates on venue identity only; experiences flow through preference spine.

## Out of scope

- Reworking the injector to schedule experience phrases as activity slots (already handled by preference-spine USER WISHES).
- Frontend wording on the must-do form.
- Healing already-persisted `partial` trips (a normal user save will re-evaluate the gate and flip to `ready`).
