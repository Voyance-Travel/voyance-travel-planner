## Bundle: Bug #1 status + 5 audit findings

### Status check
**Item 1 (Bug #1 — orphan transit after meal-guard splices) is already merged** in the previous turn:
- `day-validation.ts` calls `pruneOrphanTransits(activities)` after the placeholder strip (L892) and after the duplicate-meal strip (L1025).
- `action-generate-trip-day.ts` calls it once more pre-save (L1884) as the idempotent safety net.
- `meal-policy.test.ts` covers the Salsify regression.

No further work needed for Bug #1 unless you want me to add additional regression cases. The remaining five items are below.

---

### Item 2 — Bug #2 leftover: 6 unsanitized description/tips renders
**Files & lines confirmed:**
- `src/components/itinerary/LiveItineraryView.tsx:636` (`currentDay.description`)
- `src/components/itinerary/LiveItineraryView.tsx:698` (`currentActivity.description`)
- `src/components/booking/VoucherModal.tsx:208` (`activity.cancellationPolicy.description`)
- `src/components/booking/SelectedHotelCard.tsx:119,121` (`hotel.description`)

**Fix:** Wrap each with the existing `sanitizeActivityText(...)` helper Lovable already uses in `ItineraryEditor.tsx`. Single-line edits, no logic change. I'll re-grep `ActivityModal.tsx`, `LiveActivityCard.tsx`, and the community-guides surface in case the audit found additional sites I haven't located yet — the user previously cited 6, I have 4 confirmed; I'll bring the total to 6 once I see the remaining two.

> **Question:** Can you paste the two remaining file:line references from your audit? Otherwise I'll do an exhaustive `rg` sweep for `\{[\w.?]+\.(description|tips|notes|aiNotes)\}` across all itinerary/booking/community surfaces and patch every hit.

---

### Item 3 — `pruneOrphanTransits` drops legit departure-day transit
**Root cause:** `orphan-transit.ts:58` unconditionally drops any transit that's the last card in the day. On a departure day, "Transfer to JFK Airport" is the final card by design — flight cards live in metadata, not activities — so it gets nuked.

**Fix:** In `pruneOrphanTransits`, exempt logistics targets from Case 1 only. Add a `LOGISTICS_TARGET_RE = /\b(airport|station|terminal|port|cruise terminal|ferry terminal|train station|gare|stazione|hbf|hauptbahnhof)\b/i` check on the parsed target (or the title when target is null). If it matches, skip the end-of-day drop. Case 2 (target name not present in following cards) stays as-is — irrelevant here since there's nothing following.

**Test:** Add a Deno case in `_shared/__tests__/` (new file `orphan-transit.test.ts`) covering: end-of-day "Transfer to JFK Airport" survives; end-of-day "Walk to Salsify" still dropped.

---

### Item 4 — `SUSPICIOUS_DUPLICATE_PRICE` flagged but not repaired
**Confirmed:** raised in `validate-day.ts:1040`; no handler in `repair-day.ts` or `validation-gate.ts`.

**Fix (mirrors the `TRUNCATED_SENTENCE` pattern from Fix #6):**
1. Add a `repair-day.ts` handler in §10b: when two adjacent activities share an identical non-zero `cost.amount` and basis isn't `user`/`booked`, blank the second one's cost (the LLM duplicated the price token across cards) and tag `repair.action='cleared_duplicate_price'`.
2. Add a `validation-gate.ts` case for `SUSPICIOUS_DUPLICATE_PRICE` → severity `error` → in-place blank of `cost`/`estimatedCost`/`price_per_person` on the offending activity, no regen. Counter logged in `[VALIDATION_GATE]`.

---

### Item 5 — `itineraryValidator` skip-list + celebration warnings have no fix path
**Located:** `validateItinerary` + `matchesSkipList` consumed in `src/components/itinerary/EditorialItinerary.tsx`. Frontend-only validator surfaces warnings with no remediation route.

**Fix:** Two lightweight options — I recommend (a):
- (a) **Demote to silent telemetry.** Filter out skip-list/celebration warnings before they reach the user-visible `ValidationIssue` array in `EditorialItinerary.tsx`; keep them in a `console.debug` for diagnostics. Reasoning: every other validator the user sees has an actionable affordance; these don't.
- (b) Wire each warning to an existing assistant action (e.g. "Find a celebration spot"). Larger lift, requires UI affordance per warning type.

> **Question:** Pick (a) silent telemetry or (b) wire to assistant action?

---

### Item 6 — Multi-day path doesn't run `applyValidationGate`
**Confirmed:** only `action-generate-day.ts:1250` calls `applyValidationGate`. `action-generate-trip-day.ts` skips it, so multi-day generation bypasses every gate handler we added (TRUNCATED_SENTENCE, WALK_OVER_THRESHOLD, plus the new SUSPICIOUS_DUPLICATE_PRICE from Item 4).

**Fix:** In `action-generate-trip-day.ts`, locate the per-day post-repair block (just after `repair-day` returns and before the orphan-transit safety net at L1884) and add the same `applyValidationGate(...)` invocation, with the same arguments shape `action-generate-day.ts:1250` uses. One-call addition, no restructuring. Logs already namespaced with `[VALIDATION_GATE]` so multi-day vs single-day stay distinguishable via the surrounding stage logger.

---

### Verification (single round)

1. `deno test --allow-all generate-itinerary/__tests__/ _shared/__tests__/` — new `orphan-transit.test.ts` and a new `duplicate-price.test.ts` pass; existing tests unchanged.
2. `npm run typecheck` — clean.
3. UI smoke: load any itinerary day with a description containing markdown/artifact tokens; assert it now renders sanitized in `LiveItineraryView`, `VoucherModal`, `SelectedHotelCard`.
4. Logs: `[VALIDATION_GATE]` lines appear during multi-day generation (not just single-day); `[ORPHAN-TRANSIT]` no longer drops "Transfer to … Airport" on last day.

### Files touched
- `src/components/itinerary/LiveItineraryView.tsx`, `src/components/booking/VoucherModal.tsx`, `src/components/booking/SelectedHotelCard.tsx` (+ any extras from the rg sweep) — sanitize wrappers
- `src/components/itinerary/EditorialItinerary.tsx` — filter skip-list/celebration warnings (Item 5a)
- `supabase/functions/_shared/orphan-transit.ts` — logistics-target exemption
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — duplicate-price handler
- `supabase/functions/generate-itinerary/pipeline/validation-gate.ts` — duplicate-price case
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — gate call in multi-day path
- New tests: `supabase/functions/_shared/__tests__/orphan-transit.test.ts`, `supabase/functions/generate-itinerary/__tests__/duplicate-price.test.ts`

### Two questions before I implement
1. Item 2: paste the remaining two unsanitized sites from your audit, or want me to do an exhaustive sweep?
2. Item 5: option (a) silent telemetry or (b) wire to assistant action?
