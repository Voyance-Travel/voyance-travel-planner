## What the user reported (and what's actually wrong)

The user's diagnosis says "no scheduler tracks must-dos across multi-day generation" — that's **stale**. The deterministic cross-day scheduler (`_shared/schedule-must-dos.ts` + `_shared/inject-missing-must-dos.ts`) already runs at chain-finalization in `action-generate-trip-day.ts` (line ~3813) when `dayNumber >= totalDays`. It correctly assigns user-selected venues to the lowest-landmark-load day and stamps `metadata.must_do_coverage`.

The Amsterdam trip `51df6c32…` proves it: "Take a canal boat tour" was injected on Day 3, 10:30–12:00 as a locked anchor, persisted to JSON, to `itinerary_activities`, and to `activity_costs`. The card is NOT hidden by `isGhostActivity` (it short-circuits on `isLocked:true`).

### The real bug: injection runs after enrichment

`enrich-day.ts` (which resolves real operator names + addresses + descriptions via `verified_venues` / Google Places for cards flagged `needsAnchorEnrichment:true`) runs **per day, inside the day's pipeline, BEFORE the chain-finalization step that injects missing must-dos**. So the injected card persists forever as:

```json
{ "title": "Take a canal boat tour",
  "location": { "name": "Take a canal boat tour", "address": "" },
  "description": "",
  "needsAnchorEnrichment": true,
  "isLocked": true }
```

The card renders, but with no real operator (Stromma / Lovers / Flagship), no address, no description. To the user this reads as "the canal boat tour is missing" or as a placeholder card.

### Scope check across the cohort (last 14 days)

| Trip | Injected | Bare (empty address) |
|---|---|---|
| Amsterdam `51df6c32` | 3 | 3 |
| Lisbon `0fe99cb0` | 3 | 3 |
| Tokyo `d060f0d5` | 2 | 2 |
| Faro `c8003cf0` | 4 | 4 |
| Istanbul `3c2da103` | 2 | 2 |
| Buenos Aires `094d7ca4` | 3 | 3 |
| Rome `d18b2e8a` | 4 | 0 (enriched by later edit) |
| Mexico City `e4217b97` | 0 | — |

**17 of 18 injected anchors across 6 of 7 affected trips are bare stubs.**

---

## Plan

### 1. Post-injection enrichment pass (`action-generate-trip-day.ts`)

After the existing `injectMissingMustDos` block at line ~3884, when `mustDoInjection.injected.length > 0`:

- Group injected slots by `dayNumber`.
- For each affected day, re-invoke the existing `enrichDay` pipeline (or its inner `enrichActivities` helper) **scoped to anchors with `needsAnchorEnrichment:true`** — same predicate already in `enrich-day.ts` line 46-58. Locked-but-needs-enrichment is the documented escape hatch.
- Use the existing `verified_venues` → Google Places fallback chain. Soft-fail per anchor: if no operator resolves, leave the card in place but stamp `metadata.must_do_enrichment_failed: [venue,…]` and emit a `MUST_DO_ENRICHMENT_FAILED` health code (mirrors the existing `MUST_DO_INJECTION_FAILED` pattern).
- Hard timeout: 8 s per day (mirrors `description-fill.ts`). On timeout, persist the bare card — better than blocking the chain.

Sentinel: `[MUST_DO_ENRICH] day=N venue="…" resolved=true|false addr="…"`.

### 2. Description fill for injected anchors

After enrichment, if `description` is still empty, route the card through the existing `_shared/description-fill.ts` (already wired into both orchestrators). This is the same module that fixes Madrid restaurant blurbs; it's safe for an anchor card and stays inside the same Stage-6 budget.

### 3. Cross-trip backfill (one-shot)

Create a lazy edge function `backfill-must-do-anchor-enrichment` that:
- Queries trips where `metadata ? 'must_do_repair_attempted'` AND any injected card has empty `location.address`.
- Runs the same enrichment + description-fill pipeline.
- Persists via `safeUpdateItineraryData` with `saveReason:'self-heal-must-do-enrich'` (passes existing self-heal gate; respects Frozen-After-Ready + Universal Locking).
- Invoked from `TripDetail.tsx` on mount when the trip carries a bare injected anchor (gated, fires at most once per trip per session).

Closes the 6 already-affected trips listed above.

### 4. New health code + read-time audit

- Add `MUST_DO_BARE_STUB` to `auditTimingViolations` in `_shared/audit-timing.ts`: fires when a persisted card with `source:'must-do-injection'` has empty `location.address` AND empty `description` AND `needsAnchorEnrichment:true`. Surfaces in `generation_health.persistGateCodes` so future regressions trip the dashboard.
- Stamps `metadata.quality.must_do_enrichment = { attempted, resolved, unresolved }` on each chain-finalization run.

### 5. Tests

- `inject-then-enrich.test.ts` — fixture with 2 must-dos missing → inject → assert both have non-empty `location.address` AND non-empty `description` after the pass.
- `must-do-bare-stub-audit.test.ts` — fixture with bare injected card → assert `MUST_DO_BARE_STUB` code emitted.
- Extend `schedule-and-inject-must-dos.test.ts` with an assertion that injected cards carry `needsAnchorEnrichment:true` (locking the contract the new enrichment pass reads).

### 6. Memory

- Update `mem://constraints/itinerary/must-do-coverage-injection.md` with a new "Post-Injection Enrichment" section.
- Add Core line to `mem://index.md`: "Must-Do Injection → enrichment chain: `injectMissingMustDos` MUST be followed by a per-day re-enrichment pass before persist. Bare anchors (`source:'must-do-injection'` + empty address + empty description) trigger `MUST_DO_BARE_STUB` audit code."

---

## Out of scope

- Reordering the pipeline so per-day enrichment happens after injection (would require restructuring the chain — much riskier than a targeted post-pass).
- Changing the alias map or extraction logic (already correct for canal boat tour and the other 5 affected destinations).
- Frontend changes — the cards already render; this is purely a backend data-completeness fix.

---

## Files touched

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (post-injection enrichment + description-fill block)
- `supabase/functions/generate-itinerary/pipeline/enrich-day.ts` (export the per-activity enrichment helper if not already exported)
- `supabase/functions/_shared/audit-timing.ts` (new `MUST_DO_BARE_STUB` code)
- `supabase/functions/backfill-must-do-anchor-enrichment/index.ts` (new edge fn)
- `src/pages/TripDetail.tsx` (lazy invocation gate, mirrors existing self-heal patterns)
- `mem/constraints/itinerary/must-do-coverage-injection.md` + `mem/index.md`
- 3 test files