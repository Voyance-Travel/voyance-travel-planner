---
name: Must-Do Coverage & Injection (with post-injection enrichment)
description: Cross-day must-do scheduling, deterministic injection, post-injection anchor enrichment + description-fill, MUST_DO_BARE_STUB audit, and one-shot backfill.
type: constraint
---

# Must-Do Coverage & Injection

## Pipeline (chain finalization, `dayNumber >= totalDays`)

1. `extractMustDoVenues(meta)` — single source of truth for user-selected **venues**. Excludes descriptive experience phrases ("Watch the sunset from a rooftop overlooking the Bosphorus") — those have no venue identity to match, so feeding them to the coverage gate forced every Istanbul-class trip to `itinerary_status='partial'`. Classifier (`isExperiencePhrase`): leading experience verb (watch/see/experience/enjoy/explore/…), OR experience noun (sunset/rooftop/nightlife/…) without a proper-noun token, OR >7 words without a proper noun. Sibling `extractMustDoExperiences(meta)` exposes the excluded phrases for the preference spine (soft USER WISHES only, never hard coverage).
2. `assertMustDoCoverage(days, mustDos)` — two-pass identity-field match. **Pass 1**: existing whole-word matcher against alias map / venue head. **Pass 2 (NEW)**: conservative fuzzy fallback (`fuzzyVenueMatch`) when Pass 1 misses. Strips generic wrappers (`tour/visit/dinner/lunch/morning/guided/skip/line/eat/dine/…`) + stop words from BOTH venue input and activity identity fields, then requires a shared core token of length ≥5. Single-core on either side accepts (`Pantheon` ≈ `Pantheon Visit`, `Eat at Roscioli` ≈ `Dinner at Roscioli`, `Topkapi` ≈ `Topkapi Palace`); multi-core on BOTH sides requires ≥2 shared (so `Galata Tower` can't match `Galata Bridge`, `Recoleta Cemetery` can't match `Recoleta Neighborhood Walk`, `Park Güell` can't match `Park Ciutadella`). Edit-distance (Damerau-Levenshtein, ≤ floor(len/6)) fallback for transliterations of unknown venues. Description/address fields and transport/logistics rows still ignored. Closes systematic `itinerary_status='partial'` class where AI scheduled the user's must-do under a wrapper-style or shortened title. Sentinel `[MUST_DO_FUZZY_MATCH]`. Test file: `_shared/__tests__/assert-must-do-coverage.fuzzy.test.ts`.
3. `injectMissingMustDos(days, missing, ctx)` →
   - `scheduleMustDos` (clock-gated 17:00 museum / 21:00 after-dark ceilings; long-haul ≥360min skips Day 1 morning-arrival + last-day departure)
   - displacement pass against AI filler
   - emits locked anchor cards: `source:'must-do-injection'`, `isLocked:true`,
     `anchorSource:'must_do'`, `needsAnchorEnrichment:true`,
     `location:{name:title,address:''}`, `description:''`
4. **Post-injection enrichment** (NEW — `action-generate-trip-day.ts` ~L3895)
   - For each day with injected cards: `enrichAnchorActivities()` (Google Places
     resolution, 8s budget, sequential), then `fillMissingDescriptions()`.
   - Stamps `metadata.quality.must_do_enrichment = { attempted, resolved, unresolved }`.
5. Recompute completeness; assert coverage; stamp `must_do_repair_attempted`.

## Why post-injection enrichment matters

`enrich-day.ts` runs **per day, inside the day's pipeline**, but
`injectMissingMustDos` runs in chain finalization AFTER all per-day passes.
Without the post-pass, injected cards persist forever as bare stubs:

```json
{ "source":"must-do-injection",
  "location":{"name":"Take a canal boat tour","address":""},
  "description":"",
  "needsAnchorEnrichment":true,
  "isLocked":true }
```

Pre-fix scope (last 14d): 17 of 18 injected anchors across 6 of 7 trips
(Amsterdam / Lisbon / Tokyo / Faro / Istanbul / Buenos Aires) shipped bare.

## Read-time audit + backfill

- **`audit-timing.ts::MUST_DO_BARE_STUB`** (severity `warn`) fires when any
  card with `source:'must-do-injection'` has empty `location.address` AND
  empty `description`. Surfaces in `generation_health.persistGateCodes` + the
  lazy `useReadTimeAudit` mount-time auditor.
- **`backfill-must-do-anchor-enrichment` edge fn** mirrors `heal-trip-chronology`:
  user-auth + RLS access check + service-role write that bypasses
  Frozen-After-Ready. Stamps `metadata.must_do_enrichment_backfilled_at` so
  the trigger never re-fires.
- **`TripDetail.tsx` lazy invocation** — fires once per session when the
  trip carries any bare anchor and the backfill stamp is absent.

## Failure modes / sentinels

- `[MUST_DO_INJECT] attempted=… injected=… unscheduled=…` — scheduler ran
- `[MUST_DO_ENRICH] resolved=true|false title="…"` — per-anchor result
- `[MUST_DO_ENRICH_SUMMARY] attempted=… resolved=… unresolved=…`
- `[backfill-must-do] scanned=… attempted=… resolved=… filledDesc=…`
- `MUST_DO_INJECTION_FAILED` — scheduler couldn't find a slot
- `MUST_DO_BARE_STUB` — injected card persisted bare

## Predicate contract (`isAnchorNeedingEnrichment`)

Exported from `pipeline/enrich-day.ts`. True when `anchorSource` is set AND
(`needsAnchorEnrichment===true` OR address/venue empty). The post-injection
helper, the existing per-day enrichment, and the backfill fn all use this
single predicate — never duplicate it inline.

## Out of scope

- Reordering the chain so per-day enrichment runs after injection (riskier
  than the targeted post-pass).
- Changing alias map or extraction logic (already correct for the cohort).
- Frontend — cards already render; this is purely backend completeness.
