# Bug 1–4 Verification Report

## Grep checks (all ✅)

| Check | File | Hits |
|---|---|---|
| `Rejected false-positive` | `day-validation.ts:180` | 1 ✅ |
| water-crossing downgrade log | `pipeline/repair-day.ts:3655` | 1 ✅ |
| `reportRemainingDeadGap*` | `pipeline/fill-dead-gaps.ts:223,260,268,273` | 4 ✅ (helper + afternoon + evening exports) |

## Unit-test coverage (all ✅ — already exist from prior bug fixes)

| Requested case | Existing test |
|---|---|
| `"Freshen Up before anniversary dinner"` (wellness) → no `dinner` slot | `__tests__/meal-detection-false-positives.test.ts:4` |
| `"Walk to dinner"` (transport) regression guard | covered by `"Walk to lunch"` (transport) at `meal-detection-false-positives.test.ts:11` and `"Heading to brunch"` at line 39 — same code path |
| Phantom-ref scrubber drops "anniversary dinner" clause when no dinner card | `_shared/__tests__/phantom-ref-clause-scrub.test.ts:124, 132, 140` (3 cases: blank, preserve-with-dinner, semicolon-clause-drop) |
| 18:42 → 22:00 evening window returns ≥180m | `__tests__/evening-dead-gap.test.ts:11` (198m asserted) plus 17:00→22:30 case at line 44 (240m) |

**No new tests need to be written.** The previously-shipped test files for Bugs 1–4 already cover every case in the verification spec, with "Walk to lunch" / "Heading to brunch" serving as the transport-category regression guard for the "Walk to dinner" pattern (the detector keys on `category === 'transport'` + temporal-modifier prefix, not the specific meal word).

## Outstanding manual step (cannot run from sandbox)

Re-generate Istanbul trip `043d92c7-4bad-49d5-82a8-bc437e459bcf` in the live app and confirm:

- **Day 1:** B + L + D scheduled, no 4h+ evening gap (Bug 1 + 4)
- **Day 2:** B + L + D; "Freshen Up before anniversary dinner" card scrubbed unless real dinner follows; Topkapı → Çiya transit is `ferry` not `walk` (Bugs 2 + 3)
- **Day 3:** meal count matches departure-day meal-policy

Edge-function logs to watch for during regen:

- `[detectMealSlots] Rejected false-positive …`
- `[transit] Day N downgraded walk → ferry: … crosses water boundary (…)`
- `[QUALITY] Day N has Xm unplanned 18:00-22:00`
- `[SCRUB_PHANTOM_REF] …`

## Recommendation

Approve this plan to close the verification ticket — all code-level work is done. Re-generate the Istanbul trip from the live preview (or via the trip detail page) to capture the runtime sentinels; share the resulting day-cards if any expected line is missing and I'll diagnose from logs.
