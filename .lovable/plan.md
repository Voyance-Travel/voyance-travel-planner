# Fix: Day title doesn't reflect actual activities

## Problem

Day titles (the `theme` / `title` field on a generated day) are produced by the model in the same call that generates the activity list. There is no post-generation check that the title's stated theme or neighborhood actually matches what's in `activities[]`. Result: a day titled "Latin Quarter & Left Bank" can ship with a Marais brunch, a Tuileries afternoon, and an 8th-arrondissement dinner — none of which match the title.

Locations of relevant code:

- Day title field schema: `generation-core.ts:1259-1260` (`title`, `theme` strings, no constraints)
- Title cleanup pass (only fixes orphan articles): `action-generate-day.ts:662-668` and `action-generate-trip-day.ts:1498-1505`
- Day card render: `CustomerDayCard.tsx:375` reads `day.theme`
- No existing coherence/relabel logic — `rg` for "title.*coherence" finds nothing

## Approach

Add a deterministic post-generation **title-coherence pass** that runs after the day's activities are finalized (after dedup, repair, and the existing orphan-article cleanup) and either keeps the AI's title or replaces it with a content-derived label. This avoids a second LLM call and keeps cost flat.

### Algorithm

For each generated day with at least 3 activities:

1. **Extract content signal** from non-logistics activities (skip transport, accommodation, hotel returns, freshen-ups, check-ins, departures):
   - Collect `neighborhood` values (from `act.neighborhood` and `act.location.neighborhood`).
   - Collect notable venue names (museums, parks, headline activity).
   - Detect dominant vibe tags from category mix (food-heavy, museum-heavy, shopping, etc.).

2. **Score AI title against content**:
   - Tokenize title (lowercased, stripped of stopwords like "day", "of", "the", "&").
   - Coherent if **any** title token matches a neighborhood token, a venue name token, or a category-keyword (e.g., "art" + ≥2 cultural activities, "food" + ≥3 dining, "market" + market activity present, "old town"/"historic" + activities in the historic district).
   - Also coherent if the title is generic-but-honest ("Arrival in Paris", "Departure Day", "Free Day", "Day 4 in Paris") — match against a small allow-list.

3. **If incoherent, regenerate title locally**:
   - Pick the dominant neighborhood (most-activity-count among non-logistics).
   - Pick the headline activity (highest-rank cultural/sightseeing or splurge dinner).
   - Compose: `"<Neighborhood> & <Headline>"` or, when only one signal is strong, `"<Headline> in <City>"` or `"<Neighborhood> Wander"`.
   - Fallback to `"Day N in <City>"` if no signal is extractable.

4. **Mirror the new title to both `day.title` and `day.theme`** (UI reads `theme`; we keep both in sync, matching existing `generatedDay.title || generatedDay.theme` patterns).

5. **Log every rewrite** with the old title, new title, and signal used (for QA + future tuning).

### Where to wire it

A single new utility, `pipeline/coherence-day-title.ts`, exporting `enforceDayTitleCoherence(day, { city })`. Called from:

- `action-generate-day.ts` immediately after the existing orphan-article cleanup at line 668 (single-day generation).
- `action-generate-trip-day.ts` immediately after the existing cleanup at line 1505 (multi-day batch).
- `generation-core.ts:1485` (`generatedDay.title = generatedDay.title || ...`) — call right after the fallback assignment so theme/title stay aligned.

### What stays unchanged

- The model still produces day titles on the first pass; this layer only repairs incoherent ones.
- Day numbering, dates, and activity content are untouched.
- No prompt changes; we don't need to retrain the model — we sanity-check its output.

## Tests

New `pipeline/coherence-day-title.test.ts` covering:

- Title "Latin Quarter & Left Bank" + activities all in 8th arr → relabels to neighborhood-derived title.
- Title "Marais Stroll" + ≥2 activities in Marais → kept.
- Title "Day 4" (generic) + 3 museum activities → upgraded to "Museum Day in Paris".
- Empty/missing title → produces non-empty title from content.
- Logistics-only fragments (arrival day) → keeps simple "Arrival in Paris".

## Memory

Add a new memory `mem://technical/itinerary/day-title-coherence` and link it from `mem://index.md` so future passes know titles are sanity-checked against content.

## Files

- New: `supabase/functions/generate-itinerary/pipeline/coherence-day-title.ts`
- New: `supabase/functions/generate-itinerary/pipeline/coherence-day-title.test.ts`
- Edit: `supabase/functions/generate-itinerary/action-generate-day.ts` (one call site)
- Edit: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (one call site)
- Edit: `supabase/functions/generate-itinerary/generation-core.ts` (one call site)
- New memory file + `mem://index.md` update

No DB migration. No client changes (UI already reads `day.theme`).
