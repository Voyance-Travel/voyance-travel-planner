## Problem
A real-world activity card (Coastal Bike Exploration, Day 2) shipped to the user with `description: "The."` — a single article + period. Investigation shows our defenses miss this exact shape:

- `checkActivityDescriptions` (validate-day.ts) flags `description.length < 30` as `MISSING_DESCRIPTION`, but the **repair** is delegated to `fillMissingDescriptions` in `_shared/description-fill.ts`. When that 8s LLM call times out / errors / returns < 30 chars / fails the restaurant guard, the function **leaves the original string in place** (`act.description` is only assigned in the success branch). So `"The."` survives.
- `scrubSentenceFragments` in `_shared/prompt-leak-scrub.ts` is a no-op for **single-sentence** strings (intentional — see line 210: "Single-sentence: only flag, don't strip"). `"The."` is one sentence.
- No FE sanitizer drops article-only descriptions either, so the persisted card renders verbatim.

This affects every code path: fresh generation (refill failed silently), chain regen, and any legacy persisted trip whose description-fill round failed.

## Fix — Defense in Depth (3 layers)

### Layer 1 — Backend: blank degenerate descriptions instead of preserving them

In `supabase/functions/_shared/description-fill.ts`:
- After the success-branch assignment loop, walk `targets` once more. For each target whose final `act.description` is still degenerate (regex `^\s*(the|a|an|it|this|that|here|there)\s*\.?\s*$/i` OR `trim().length < DESC_MIN_CHARS / 2` ≈ <15 chars), set `act.description = ''`. This guarantees no path leaves "The." / "A." / a 4-char stub on the card. Empty is recoverable downstream; "The." is not.
- Add a counter `counters.blanked` and include it in the `[DESC_FILL]` sentinel.

### Layer 2 — Unified Output Validation Layer

In `supabase/functions/_shared/scrub-activity.ts`:
- Add a small `scrubDegenerateBodyFields(act)` step (composed before the existing `scrubSentenceFragmentsOnAct` call) that blanks `description`, `notes`, `tips`, `summary` when they match the same article-only / `<15` chars regex above. Increment a new `ops.degenerate` counter.
- Wired automatically at every existing `scrubActivity` call site (repair-day §10b, action-save-itinerary `normalizeDays`, UI sanitizer chain) — no new boundaries needed.

### Layer 3 — Frontend safety net for legacy persisted trips

In `src/lib/itinerary/activityNameSanitizer.ts` (or the matching `sanitizeActivityText` chain — confirmed during edit): mirror the same article-only / `<15` chars blanker on read so already-saved trips like the user's Day 2 stop showing "The." without waiting for a regen.

### Memory update
Extend `mem://constraints/itinerary/sentence-integrity-guard` to record:
- Article-only / sub-15-char descriptions are blanked, not preserved.
- Three boundaries (description-fill failure path, scrubActivity, FE sanitizer) all enforce identically.
- Reasoning: empty card description is recoverable (next regen / dining-description-backfill), an article-fragment stub is not.

## Out of Scope
- Health-engine, Payments tab, same-day venue dedup, cost reconciliation — none touched.
- No prompt/template changes; this is purely an output-validation tightening.

## Verification
- Add unit tests in `supabase/functions/_shared/__tests__/scrub-activity.test.ts` covering `description: "The."`, `"A."`, `"It."`, `"The"` (no period), and a legitimate 35-char description (must NOT be blanked).
- Add a description-fill test: when the LLM mock returns a 5-char string, the original "The." is replaced with `''`, not retained.
- Spot-check the user's affected trip after deploy: card body should render empty state, not "The."

## Files to edit
- `supabase/functions/_shared/description-fill.ts`
- `supabase/functions/_shared/scrub-activity.ts`
- `src/lib/itinerary/activityNameSanitizer.ts` (or equivalent FE text sanitizer)
- `supabase/functions/_shared/__tests__/scrub-activity.test.ts` (extend)
- `mem://constraints/itinerary/sentence-integrity-guard` (extend)
