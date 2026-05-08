## Unified LLM Output Validation Layer

**Premise (yours, accepted):** every blocker — prompt artifacts, wrong-city venues, payment drift, fragment sentences, label/meal mismatches — is the same bug at different layers: raw LLM output is reaching the UI without a single, enforced validation pass. We have *pieces* of this (`scrubBodyPromptLeaks`, `scrubTitleLeaks`, `scrubSentenceFragments`, `detectCrossCityMention`, `verified-venues-filter`, `nuclearCrossCitySweep`, `clampBookendEndTime`, `pruneNonLogisticsAfterCheckout`, canonical cost resolver) but they're scattered across 4 pipelines (generate, repair, save, UI) and the address-to-destination guard is the missing one. This plan unifies them behind one boundary, with telemetry that proves coverage.

### What this plan is NOT

- Not a prompt rewrite. Prompts stay as-is.
- Not a payments re-architecture (last loop already consolidated manual fold + reserve gating + orphan reconciliation in `resolveCanonicalCostRows`/`useTripFinancialSnapshot`/`PaymentsTab`). This plan does NOT re-touch payments — you said it's a separate area.
- Not a regen-on-failure loop for venues (too costly). Failed venues get downgraded to fallback or stripped, with sentinels.

### The four layers we lock down

```text
                    ┌──────────────────────────────────┐
LLM raw JSON ─────► │  L1: parse + truncation guard    │  (extract-json, finish_reason check)
                    └─────────────┬────────────────────┘
                                  ▼
                    ┌──────────────────────────────────┐
                    │  L2: scrubActivity (PURE FN)     │  ← new single entry point
                    │   • title leaks                  │
                    │   • body leaks                   │
                    │   • sentence fragments           │
                    │   • meal-suffix strip            │
                    │   • bookend clamp                │
                    │   • walking-leg $0               │
                    └─────────────┬────────────────────┘
                                  ▼
                    ┌──────────────────────────────────┐
                    │  L3: validateActivity (NEW)      │  ← address-resolves-to-destination
                    │   • cross-city venue detect      │     is the new piece
                    │   • address city-resolve check   │
                    │   • venue↔meal label coherence   │
                    │   returns {ok, downgrade, drop}  │
                    └─────────────┬────────────────────┘
                                  ▼
                    ┌──────────────────────────────────┐
                    │  L4: persist + DB triggers       │  (last-gate, already in place)
                    └──────────────────────────────────┘
```

### Steps

**Step 1 — Single entry point `scrubActivity(act, ctx)`** in `supabase/functions/_shared/scrub-activity.ts`. Composes existing helpers (`scrubTitleLeaks`, `scrubBodyPromptLeaks`, `scrubSentenceFragmentsOnAct`, meal-suffix strip, walking-leg $0, bookend clamp). Returns `{changed, ops: string[]}`. Mirror in `src/utils/scrubActivity.ts` with the same regexes (kept literal for the front bundle, like `activityNameSanitizer.ts` does today).

**Step 2 — New `validateActivity(act, {destination, mealSlot})`** in same file. Three checks:
1. `detectCrossCityMention` on title + venue + address + description.
2. Address city-resolve: if `act.address` has a postal/region/country token that mismatches the destination city, flag.
3. Meal/venue label coherence: if `mealSlot === 'lunch'` and venue name contains `(Dinner)`/`(Breakfast)` (post meal-suffix strip miss), flag.

Returns `{verdict: 'ok' | 'downgrade' | 'drop', reason}`. `downgrade` → strip venue identity via existing `stripVenueIdentity` + `resolveAnyMealFallback`/`applyFallbackToActivity`. `drop` → mark `needsVenuePick` $0 sentinel. **No regen call** — costs zero credits.

**Step 3 — Wire single boundary at 4 sites (replace ad-hoc calls):**
- `generate-itinerary/pipeline/validate-day.ts` (per-activity loop)
- `generate-itinerary/pipeline/repair-day.ts` §10b (replace separate scrubs)
- `generate-itinerary/action-save-itinerary.ts` per-day loop (replace 3 separate scrub calls)
- `src/utils/activityNameSanitizer.ts` UI sanitizer chain (last-mile)

Each site keeps its existing sentinels (`[POST_CHECKOUT_PRUNE]`, `[BOOKEND_CLAMP]`, etc.) but routes through `scrubActivity` so we cannot forget to add a new helper to one of four sites again.

**Step 4 — Address-to-destination guard (the missing piece you called out).** New file `supabase/functions/_shared/address-city-resolve.ts`. Lightweight: regex-based country/region tokens (`, Italy`, `, France`, `75001`, `30100`, `34xxx Florence`) checked against `destination`'s known country/postal-prefix from a small static map (we already have `INLINE_FALLBACK_*` city DBs — extend with country + postal prefix). When mismatch detected → `validateActivity` returns `downgrade`. No Google Geocoding call (Google API centralization rule + cost).

**Step 5 — Observability.** One structured log line per save: `[SCRUB_ACTIVITY] tripId=… day=… ops={titleLeak:N,bodyLeak:N,fragment:N,crossCity:N,addressMismatch:N,mealLabel:N,bookendClamp:N,walkingZero:N,downgraded:N,dropped:N}`. Persist last counters into `metadata.quality.scrub_ops` so we can grep `trips.itinerary_data->'metadata'->'quality'->'scrub_ops'` and prove a class of leak is at zero.

**Step 6 — Tests.** Extend `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts` into `scrub-activity.test.ts` with regression fixtures for: (a) Tartine SF in Venice → downgrade, (b) `(FLEX_WINDOW)` in title → strip, (c) "spot for together" fragment → drop sentence, (d) `Reservation Urgency: .` → strip, (e) Da Ivo dinner relabeled as casual → identity stripped, (f) walking leg priced $30 → $0, (g) bookend 23:50→00:28 → clamped 23:59. Lint test in `_shared/__tests__/no-direct-scrub-call.test.ts` blocks new code from calling individual helpers outside `scrubActivity`.

**Step 7 — Memory.** New `mem://constraints/itinerary/unified-output-validation-layer.md` documenting the contract + 4 wire sites + verdict semantics. Update `mem://index.md` Memories list.

### Files touched

- new: `supabase/functions/_shared/scrub-activity.ts`
- new: `supabase/functions/_shared/address-city-resolve.ts`
- new: `src/utils/scrubActivity.ts`
- new: `supabase/functions/_shared/__tests__/scrub-activity.test.ts`
- new: `supabase/functions/_shared/__tests__/no-direct-scrub-call.test.ts`
- edit: `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
- edit: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- edit: `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- edit: `src/utils/activityNameSanitizer.ts`
- new memory + index update

### What you'll see after this ships

- `[SCRUB_ACTIVITY]` log on every save with per-class counters > 0 only when the LLM actually leaked something.
- The four blockers either silently scrubbed (artifacts, fragments, label leaks, bookend bleed) or downgraded to neutral fallback (cross-city venues, address mismatches) — never raw to UI.
- Adding a new sanitizer in the future = one place to add it (`scrubActivity`), enforced by lint test.

Approve and I'll implement.