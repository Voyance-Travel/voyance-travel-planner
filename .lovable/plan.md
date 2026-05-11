## Bug 3 — Phantom meal references in non-dining card descriptions

**Root cause.** `prompt-leak-scrub.ts` already has a phantom-ref scrubber (`scrubPhantomEventRefs`) that compares card copy against a `DayScheduleSummary` (which already tracks `hasBreakfast/hasLunch/hasDinner/...`) and is wired into `scrubActivity` at validate-day, repair-day §10b, save-itinerary, and the UI sanitizer.

The detector covers time-bound prefixes only:
- `tonight's dinner`, `this evening's dinner`
- `today's lunch`, `this afternoon's lunch`
- `this morning's breakfast`
- `leave by HH:MM for ...`
- `after/before/following + (the|your|tonight's|today's|this evening's|...) + noun`

It does **not** match bare prep references like `"Freshen Up before anniversary dinner."` — `before` is not followed by a determiner, so the existing `after/before/following` pattern falls through and the clause survives even when the day has no dinner card.

The plumbing (per-day summary, multi-call-site invocation, blank-vs-rebuild rules, validation-gate detector) is correct. The fix is just **one new pattern** plus tests.

## Change

### `supabase/functions/_shared/prompt-leak-scrub.ts`

Append a new entry to `PHANTOM_REF_PATTERNS` that catches bare prep-verb references to meals when no determiner is present:

```ts
// "before/after/for/prep for/ahead of/en route to anniversary dinner" —
// bare meal reference without a determiner. Resolves only when the day
// actually contains the named meal slot (post meal-guard injections, the
// summary reflects every scheduled card).
{
  re: /\b(?:before|after|for|prep(?:aring)?\s+for|ahead\s+of|en\s+route\s+to|on\s+the\s+way\s+to|heading\s+to|towards?)\s+(?:[a-z][\w-]+\s+){0,3}?(breakfast|brunch|lunch|dinner|supper|nightcap)\b/gi,
  resolves: (m, s) => {
    const meal = (m[1] || '').toLowerCase();
    if (meal === 'breakfast' || meal === 'brunch') return s.hasBreakfast || s.hasBrunch;
    if (meal === 'lunch')   return s.hasLunch;
    if (meal === 'dinner' || meal === 'supper') return s.hasDinner;
    if (meal === 'nightcap') return s.hasNightcap;
    return false;
  },
},
```

Order matters — keep this **after** the existing time-bound patterns so the more-specific `tonight's dinner` rule still wins (avoids double-counting in `stripped`).

The single-segment blanking heuristic (≥3 substantive non-phantom words → keep) and multi-segment clause-drop logic in `scrubPhantomEventRefsFromString` already do the right thing for both cases:
- `"Freshen Up before anniversary dinner."` (no dinner) → single segment, <3 substantive words after strip → blanked → description-fill backfills.
- `"Freshen up at the Ritz; leave by 20:30 for anniversary dinner."` (no dinner) → multi-segment, second clause dropped → `"Freshen up at the Ritz."`
- `"Freshen Up before anniversary dinner."` (dinner card present) → resolves true → no change.

No call-site changes; the new pattern flows through `scrubActivity` everywhere it's already wired (validate-day, repair-day §10b, save-itinerary `normalizeDays`, UI `activityNameSanitizer`). The validation-gate `DESCRIPTION_GHOST_REFERENCE` code reuses the same detector and will fire on residuals automatically.

### `supabase/functions/_shared/__tests__/phantom-ref-clause-scrub.test.ts`

Add 4 cases:
1. `"Freshen Up before anniversary dinner."` + summary with `hasDinner=false` → field blanked.
2. Same input + `hasDinner=true` → unchanged.
3. `"Freshen up at the Ritz; leave by 20:30 for anniversary dinner."` + `hasDinner=false` → second clause dropped, first kept with period.
4. `"Light walk before lunch at Casa Mono"` + `hasLunch=true` → unchanged (no false positive when meal exists; protects rich single sentences via the ≥3-substantive-word rule).

## Out of scope

- No changes to `buildDayScheduleSummary` (already tracks every meal slot needed).
- No changes to `_shared/scrub-activity.ts` or its call sites.
- No changes to `validation-gate.ts` — it already emits `DESCRIPTION_GHOST_REFERENCE` via the shared detector.
- Generic non-meal phantom nouns (e.g. "before the gallery" without determiner) are intentionally not added; user scope is meal references only.

## Verification

- `deno test --allow-all supabase/functions/_shared/__tests__/phantom-ref-clause-scrub.test.ts` (existing 4 + new 4 pass).
- Sentinel `[SCRUB_PHANTOM_REF] stripped=N fields=description …` already logs from `scrubActivity`.
- Re-generate the Istanbul Day 2 trip → "Freshen Up" card description no longer mentions "anniversary dinner" when no dinner card follows.
