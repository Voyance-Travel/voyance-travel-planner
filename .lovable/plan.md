## Wire `getBehavioralEnrichment` into the generation prompt

### Context

`getBehavioralEnrichment(supabase, userId)` exists at `supabase/functions/generate-itinerary/preference-context.ts:256` but has zero call sites. It returns:

```ts
{ likedCategories: string[], avoidedCategories: string[], timePrefs: { category: string; slot: string }[] }
```

The user request describes fields like `frequentlyRemoved` / `frequentlyLocked` / `preferredTimeWindows` / `swappedAwayCategories` — these don't exist on the actual return shape, so we map to the real fields: `avoidedCategories`, `likedCategories` (which already encodes lock/positive signal via the `category_preference` weighting), and `timePrefs`. There is no swap-away aggregation in the current implementation; we will not invent one.

### Established pattern

Behavioral context is assembled in `action-generate-trip.ts` into `enrichmentContext.<X>Prompt` strings, then pushed into the prompt by `pipeline/compile-prompt.ts` around line 832 (alongside `pastTripLearnings` and `behavioralPreferencesPrompt`). We follow this pattern rather than mutating `preferenceContext` directly.

### Changes

**1. `supabase/functions/generate-itinerary/action-generate-trip.ts`**

- Add `getBehavioralEnrichment` to the existing import from `./preference-context.ts` (currently imports `getUserPreferences`).
- Add a new sub-step **10c** immediately after the `activity_feedback` block (after line 488), in a non-blocking `try/catch`:
  - Call `await getBehavioralEnrichment(supabase, userId)`.
  - If non-null and any of `likedCategories` / `avoidedCategories` / `timePrefs` is non-empty, set:
    - `enrichmentContext.behavioralEnrichment = enrichment` (object, for downstream metadata).
    - `enrichmentContext.behavioralEnrichmentPrompt` = formatted markdown block with three bullets:
      - `Categories user has gravitated toward (locks / repeat picks): {likedCategories}`
      - `Categories user has removed across past trips (avoid unless explicitly requested): {avoidedCategories}`
      - `Preferred time-of-day patterns: {timePrefs.map(t => t.category + '→' + t.slot).join(', ')}`
  - Empty arrays render as `no clear pattern yet`, matching the `behavioralPreferencesPrompt` convention.
  - Log: `[generate-trip] Behavioral enrichment: liked=[…] avoided=[…] timePrefs=N`.

**2. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

- One-line addition after line 832:
  ```ts
  if (gc.behavioralEnrichmentPrompt) promptParts.push(gc.behavioralEnrichmentPrompt as string);
  ```
- Add `behavioralEnrichmentPrompt?: string` (and optional `behavioralEnrichment?: any`) to the GeneratorContext type if it's strictly typed in this file (will confirm during edit; current siblings like `pastTripLearnings` are read off `gc as any` so this may be no-op).

### Out of scope

- No DB migration.
- No new aggregation logic in `preference-context.ts` (no fabricated `swappedAwayCategories` / `frequentlyLocked`).
- No changes to `generation-core.ts` / `action-generate-day.ts`; they read the assembled `preferenceContext` string already.

### Verification

- `rg -n "getBehavioralEnrichment" supabase/functions/generate-itinerary/` → 2 hits (definition + new call site in `action-generate-trip.ts`).
- `rg -n "behavioralEnrichmentPrompt" supabase/functions/generate-itinerary/` → 2 hits (assignment + push in `compile-prompt.ts`).
- Generate a trip for a user with `user_enrichment` rows; confirm `[generate-trip] Behavioral enrichment: …` log line and that the `## BEHAVIORAL ENRICHMENT` section shows up in the compiled prompt.