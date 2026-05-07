## Problem

Day-2 cards still show AI prompt scaffolding because the existing regexes only catch a narrow set of phrasings. Live DB samples include forms the current sanitizers miss:

- `Essential Roman landmark providing the 'Deep Context' required for this traveler profile.`
- `Specifically satisfies the Interest for wellness in a high-end Roman setting.`
- `Fulfills the 'Authentic Encounter' wellness interest with a high-end relaxation experience.`
- `As a 'Transformer' arche, this deep-driven history aligns with your desire for meaningful travel encounters.`
- `Provides the deep historical context you value while maintaining a high-quality, aesthetically pleasing environment.`
- `Deep context stop` (whole title)
- `Deep context at the Estrela Basilica rooftop` (whole title)
- `This is ; the illuminated monuments provide the perfect aesthetic backdrop...` (orphan from earlier sanitizer pass)

The current rules require a sentence to start with `This <verb> the/your/their …`. Variants beginning with `Essential`, `Provides`, `Specifically`, `As a 'X' arche`, or starting with `Fulfills`/with no leading `This` slip through. The orphan `This is ;` artifact is a side-effect of an earlier replacement leaving fragments behind.

## Plan

Strengthen sanitization in **two places** (mirror frontend + server) without touching business logic:

### 1. `src/utils/itineraryParser.ts` — extend `sanitizeDisplayString`

Add these replacements (in order) after the existing slot/AESTHETIC rules:

- **Quoted-archetype clauses anywhere** — match `'<Label>' <noun>` clauses regardless of leading verb:
  `(?:providing|satisfying|fulfilling|matching|delivering|offering|reflecting|catering to|aligning with|aligns with|tailored to|in line with)\s+(?:the\s+)?['"\u2018\u201C][^'"\u2019\u201D]{2,40}['"\u2019\u201D]\s+(?:interest|preference|requirement|slot|need|moment|context|arche\w*|profile|trait|fit)[^.]*\.?`
- **Bare `Fulfills/Satisfies/Addresses ... requirement|interest|slot|block|moment` sentences** (no leading `This`):
  `(?:^|[.!?]\s+)(?:Fulfills?|Satisfies|Addresses|Specifically\s+(?:fulfills?|satisfies|addresses))\b[^.]*\b(?:requirement|interest|slot|block|moment|need|preference|profile|arche\w*)\b[^.]*\.?`
- **`As a '<Label>' arche…` framing**:
  `\bAs\s+a\s+['"\u2018\u201C][^'"\u2019\u201D]{2,40}['"\u2019\u201D]\s+arche\w*[^.]*\.?`
- **`Deep [historical] context` / `traveler profile` filler phrases** stripped from any sentence:
  `\b(?:provid(?:es|ing)|offer(?:s|ing)|deliver(?:s|ing))\s+(?:the\s+)?(?:deep|rich|essential)\s+(?:historical\s+)?context[^.]*\.?`
  `\bfor\s+this\s+traveler\s+profile\b\.?`
- **Standalone titles equal to** `Deep context`, `Deep context stop`, or starting with `Deep context ` (case-insensitive) — drop the `Deep context ` prefix; if nothing remains, return `undefined` so caller falls back to a default name.
- **Orphan fragment cleanup** — collapse `This is\s*[;,.]` and `\bis\s*;\s*` left over from prior replacements; collapse repeated punctuation `[.,;:]{2,}` → single, then re-trim.

### 2. `supabase/functions/generate-itinerary/sanitization.ts`

Mirror the same six rules in the server-side `sanitizeText` (around lines 1025–1037) so newly generated trips never persist these strings.

### 3. Tests

Extend `src/utils/__tests__/itineraryParser.artifacts.test.ts` with one assertion per new variant above, plus a "preserve legitimate prose" guard:
- `"Reserve a time slot for the tour."` stays intact
- `"Essential historical context for the city's founding."` stays intact (only the *traveler-profile* / *deep context* + verb variants are stripped; bare "historical context" is kept)

### 4. One-time DB cleanup (optional, ask before running)

After the regex is verified, offer to run a backfill that re-sanitizes `itinerary_data` for the 4 affected trip IDs so existing users see clean copy without regenerating. Not part of this plan unless approved.

## Out of scope

- Fixing the upstream prompt that produces these phrases.
- Cost, booking, scheduling, or layout changes.
- Regenerating itineraries.

## Files to edit

- `src/utils/itineraryParser.ts`
- `supabase/functions/generate-itinerary/sanitization.ts`
- `src/utils/__tests__/itineraryParser.artifacts.test.ts`
