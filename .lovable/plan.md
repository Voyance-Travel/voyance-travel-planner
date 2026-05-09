## Semantic Validation Gate — block bad output, don't just classify it

**Premise (yours, accepted):** `validate-day.ts` already detects failures and returns typed `ValidationResult[]`, but nothing in `action-generate-day.ts` treats that classification as a *gate*. Repair runs deterministic structural fixes; validation is purely informational. Semantic failures (dot-only fields, mid-sentence truncation, duplicate prices, vibe/category mismatches, cross-day checkout-then-hotel-activities) classify but ship. This plan adds the missing blocking layer + 4 new semantic checks + 1 cross-day fact, without touching prompts or repair-day's existing 12 deterministic rules.

### What this is NOT

- Not a prompt rewrite.
- Not a re-architecture of `repair-day.ts` — its 12 rules stay as-is.
- Not a new regen-on-every-failure loop. Regen is the **last** resort, gated on `critical` only, capped at 1 retry per day.
- Not a payments touch, not a scrub-activity touch (last loop's work stands).

### The four pieces

```text
generate ─► sanitize ─► repair-day (structural) ─► scrubActivity (artifacts)
                                                          │
                                                          ▼
                                               ┌──────────────────────┐
                                               │  validateDay()       │  (already exists)
                                               │  + 4 new checks      │  ← Step 2
                                               │  + cross-day facts   │  ← Step 3
                                               └──────────┬───────────┘
                                                          ▼
                                               ┌──────────────────────┐
                                               │  GATE (NEW)          │  ← Step 1
                                               │  critical → 1 regen  │
                                               │  error  → re-repair  │
                                               │  warn   → log only   │
                                               └──────────┬───────────┘
                                                          ▼
                                                       persist
```

### Step 1 — The Gate (the actual missing piece)

New `pipeline/validation-gate.ts` exporting `applyValidationGate(day, validationResults, ctx)`. Called in `action-generate-day.ts` immediately after the existing `validateDay()` call (around line 1187, before the repair block at 1198).

Severity policy:
- **`critical`** (new tier — see Step 2): block persist; trigger one targeted regen of the failing day. If retry still critical → downgrade offending activity via existing `downgradeCrossCityActivity` / `needsVenuePick` sentinel and persist with `metadata.quality.gate_forced_persist = true`.
- **`error`**: re-run `repair-day` once with `validationResults` re-fed. If still present after second pass, persist + log `[GATE_ERROR_LEAK]`.
- **`warning`**: persist, log only.

Retry budget tracked on the day: `metadata.quality.gate_retries`. Hard cap = 1 to keep credits bounded (per "charge-on-action" rule).

Returns `{verdict: 'persist' | 'regen' | 'repair_again', forcedDowngrades: number, retries: number}` for the orchestrator.

### Step 2 — Four new semantic checks in `validate-day.ts`

All four are pure inspectors, ~20 lines each, slotted next to existing `checkLabelLeaks` / `checkChainRestaurants`:

1. **`checkPunctuationOnlyFields`** — any string field on the activity (title, description, tips, notes, `reservationUrgency`, `bookingWindow`, etc.) matching `/^\s*[.\-:,;·•]+\s*$/` → `severity: 'critical'`, `code: PUNCTUATION_ONLY_FIELD`. Catches `Reservation Urgency: .` survivors that slipped past `scrubBodyPromptLeaks` because the label was already stripped, leaving the value field as just `.`.

2. **`checkSentenceCompleteness`** — for `description` / `body` fields > 40 chars: trimmed value must end in `.!?…)"'` or close-quote. Mid-sentence cutoffs ("...ideal with for both") → `severity: 'error'`, `code: TRUNCATED_SENTENCE`. Skips bullet lists and known label fields. Fragment helper from `prompt-leak-scrub.ts` already has the regex shape; reuse it.

3. **`checkPriceDuplication`** — adjacent activities with identical non-zero `cost.amount` AND same currency AND same category → `severity: 'warning'`, `code: SUSPICIOUS_DUPLICATE_PRICE`. Warning only; this is a sniff test, not a hard fail. Skips $0 (walking, free) and skips when both are flagged `bar_cap_repair` / `fine_dining_floor` (deterministic overrides).

4. **`checkCategoryVenueCoherence`** — `category === 'dining'` + venue name matches existing `KNOWN_FINE_DINING_STARS` map + title contains `casual|neighborhood|trattoria|bistro` → `severity: 'error'`, `code: CATEGORY_VENUE_MISMATCH`. Mirrors the vibe-clash logic in `ledger-check.ts` but at the validation layer so it gates *before* persist instead of being post-hoc.

Add `'critical'` to the severity union in `pipeline/types.ts` (currently `'error' | 'warning'`). Add the four new codes to `FAILURE_CODES`.

### Step 3 — Cross-day context for `repair-day.ts`

The "Day 3 checkout 17:50 then Day 3 hotel-spa 19:30" bug is a per-day blind spot, not a missing rule. Fix in `compile-day-facts.ts`:

- Extend `DayFacts` with `previousDayLastEvent: { time24, kind: 'checkout' | 'flight_dep' | 'transit' | 'leisure', city }` and `nextDayFirstEvent` (mirror, for arrival-day checks).
- `repair-day.ts` `checkLogisticsSequence` (already exists, line ~532 in validate-day) gets a new sub-check: if `previousDayLastEvent.kind === 'checkout'` and current day has hotel-bound activities (spa, hotel-restaurant, hotel-room) before any new check-in, flag `CHECKOUT_HOTEL_LEAK` → `critical`. Gate handles the regen.

### Step 4 — Telemetry & Memory

- Single log line per day: `[VALIDATION_GATE] day=N verdict=… critical=N error=N warning=N retries=N forcedDowngrades=N`.
- Persist into `metadata.quality.validation_gate` so it's grep-able alongside existing `metadata.quality.scrub_ops`.
- New `mem://constraints/itinerary/validation-gate-blocking-layer.md` documenting severity policy, retry budget, and the 4 new codes. Update `mem://index.md`.

### Files touched

- new: `supabase/functions/generate-itinerary/pipeline/validation-gate.ts`
- edit: `supabase/functions/generate-itinerary/pipeline/types.ts` (add `'critical'` + 5 new `FAILURE_CODES`)
- edit: `supabase/functions/generate-itinerary/pipeline/validate-day.ts` (4 new checkers + 1 cross-day check)
- edit: `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts` (`previousDayLastEvent` / `nextDayFirstEvent`)
- edit: `supabase/functions/generate-itinerary/action-generate-day.ts` (wire `applyValidationGate` between validate and repair, plus regen branch)
- new: `supabase/functions/_shared/__tests__/validation-gate.test.ts` — fixtures for: dot-only `reservationUrgency`, "ideal with for both." truncation, duplicate €58 dinners, "Casual neighborhood dinner at Da Ivo", checkout-17:50 then spa-19:30
- new memory + index update

### What you'll see after this ships

- `[VALIDATION_GATE]` log on every day with verdict + counts.
- Critical semantic failures either regen once or downgrade to `needsVenuePick` $0 sentinels — never raw to UI.
- `metadata.quality.validation_gate.critical` should sit at 0 across runs; non-zero is the new alarm.
- Retry budget capped at 1/day so credit cost stays bounded.

Approve and I'll implement.