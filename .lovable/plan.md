
Issue confirmed: this is not user error. We have corrupted day text being saved from generation (example in backend data: `Arrival and Academic Roots抽,title:`), which explains why you keep seeing it repeatedly.

## Why this is happening

1. The day-generation pipeline is trusting AI strings too much before save.
2. The existing sanitizers remove some artifacts, but they do not reliably strip schema-leak fragments like `,title: -`.
3. The generation preview path (`useItineraryGeneration`) currently renders raw day/activity strings from the backend response with minimal cleanup.
4. Existing corrupted trips keep showing the same bad text because display parsing does not fully scrub these artifacts.

## Implementation plan

### 1) Harden backend generation sanitization at the source
**File:** `supabase/functions/generate-itinerary/index.ts`

- Add a dedicated deep text sanitizer for generated day payloads (day title/theme/narrative + activity title/name/description/location/tips).
- Extend leak-pattern cleanup to catch:
  - `,title: ...`
  - `,theme: ...`
  - `,dayNumber: ...`
  - `practicalTips`/`accommodationNotes` fragments
  - stray CJK artifacts like `抽`
- Apply sanitizer in **both** generation branches:
  - `action === 'generate-day' | 'regenerate-day'`
  - `action === 'generate-full'` Stage 2 path
- Ensure fallback normalization still runs after cleanup:
  - if day title becomes empty, fallback to `theme` or `Day N`
  - if activity title becomes empty, fallback to `Activity N`

### 2) Add frontend safety-net sanitization for live generation preview
**File:** `src/hooks/useItineraryGeneration.ts`

- Sanitize incoming `generatedDay` text before putting it into local state (and before partial save payload composition).
- This ensures users don’t see raw artifacts even if a backend edge-case slips through.

### 3) Strengthen shared text sanitization rules
**File:** `src/utils/textSanitizer.ts`

- Expand schema-leak regex patterns to include `title`-style leaked keys safely.
- Keep cleanup conservative to avoid removing legitimate natural language.
- Reuse this same sanitizer from generation-facing paths to avoid duplicated regex logic.

### 4) Protect existing itinerary rendering paths
**File:** `src/utils/itineraryParser.ts`

- Upgrade `sanitizeDisplayString` to also strip schema-leak fragments (not just non-Latin script).
- This cleans already-stored bad content when reading historical trips, so old broken titles won’t keep appearing.

### 5) One-time cleanup for existing corrupted records
**Backend data repair (migration/script):**

- Run a targeted cleanup update for known leak patterns in:
  - `trips.itinerary_data` JSON day titles/themes/narratives
  - `itinerary_days.title/theme`
- Scope pattern cleanup to obvious schema-leak signatures (`title:`, `practicalTips`, etc.) and CJK artifacts to avoid altering legitimate content.

## Validation checklist

1. Reproduce with the same “Just Tell Us” scenario that previously produced `抽,title: -`.
2. Confirm generated day title/theme is clean in:
   - generation preview
   - trip detail page
   - saved trip reload.
3. Confirm activity titles are clean and still meaningful.
4. Confirm no regressions in normal valid titles (nothing over-sanitized).
5. Verify existing corrupted trips now display clean text after parser/cleanup pass.

## Expected outcome

- New trips: this artifact stops appearing.
- Existing trips: corrupted labels are cleaned on read (and optionally repaired in DB).
- User experience: no more repeated dead-end of seeing malformed titles after regeneration.
