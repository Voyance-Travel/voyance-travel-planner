## Root cause

Querying the three test trips in the DB confirms the failure shape:

| Trip | Day | Last activity | endTime | Bookend? |
|---|---|---|---|---|
| Madrid | 1 | Romantic Dinner at Botín | 22:45 | ✓ Return added 22:45–23:15 |
| Madrid | 2 | Freshen up at Ritz (mid-evening accommodation) | 21:40 | ✗ none — but at-hotel, "works" |
| **Florence** | **1** | **Secluded Nightcap at Bulli & Balene** | **00:10** | **✗ MISSING** |
| **Florence** | **2** | **Birthday Nightcap at Fusion Bar** | **22:55** | **✗ MISSING** |
| Florence | 3 | Freshen up at hotel | 18:05 | ✗ none — at-hotel |
| **Barcelona** | **2** | **Nightcap at Paradiso Speakeasy** | **00:20** | **✗ MISSING** |
| Barcelona | 1 | Wander El Born | 21:50 | ✓ Return added 21:50–22:20 |

The pattern is **days that end on a late nightcap / drinks card**, not "Day 1 across all cities". Madrid Day 1 actually works because it ends on dinner.

The existing `runStep8` in `universal-quality-pass.ts` already has a late-nightlife-bleed branch (per the **Late-Nightlife Hotel Return** memory) and a save-time net in `action-save-itinerary.ts`. Both call paths exist. So why isn't a card landing?

Two leaks:

### Leak A — pre-dawn strip eats the late-nightlife bookend it just emitted

`_shared/predawn-hotel-strip.ts::stripPreDawnHotelReturns` removes **any** card with `startTime < 05:00` whose category is `accommodation` (or whose title matches `return to|hotel|...`). The just-pushed late-nightlife bookend is exactly that:

```ts
{ category: 'accommodation', startTime: '00:10', source: 'late_nightlife_bookend' }
```

`runStep8` pushes the card at line 173, then `stripPreDawnHotelReturns(result, …)` at line 416 immediately strips it. The same strip runs in `terminalCleanup` and `persist-day` and `action-sync-tables` — each one wipes the legitimate bleed bookend. **Florence Day 1 (00:10 nightcap)** and **Barcelona Day 2 (00:20 speakeasy)** are killed here.

### Leak B — Florence Day 2 (22:55 nightcap) — missed by save-time net

This day's last endTime is 22:55, **not** pre-dawn, so Leak A doesn't apply. Tracing:

1. Day requires dinner (luxury archetype, full day) → Step 8 deferred.
2. Meal-guard couldn't add a real dinner → no card injected.
3. Post-meal-guard runStep8 retry in `action-generate-trip-day.ts:1808` only runs when `mealsInjected > 0` (need to verify the gate condition).
4. Save-time net at `action-save-itinerary.ts:432` runs unconditionally — should fix it. **Need to confirm** whether the `nonLogistics` filter or some other guard is short-circuiting on a day whose only "non-logistics" card is `relaxation` / `activity` (nightcap). The filter only excludes transport categories so it should pass; suggests the post-meal-guard retry gate is the one being missed.

## Fix

### 1. Make the pre-dawn strip source-aware (`_shared/predawn-hotel-strip.ts`)

Skip cards that the bookend pipeline just minted as legitimate post-midnight:

```ts
const src = String(act?.source || '').toLowerCase();
if (src === 'late_nightlife_bookend') continue;
const tags = Array.isArray(act?.tags) ? act.tags.map(String) : [];
if (tags.includes('late_nightlife_bookend')) continue;
```

This change is local to the strip function and inherits to all 5 call sites (`universal-quality-pass`, `action-save-itinerary`, `action-sync-tables`, `persist-day`, `action-generate-trip-day`). Sentinel: bump existing `[predawn-strip]` log to include `(skipped:N late_nightlife_bookend)`.

### 2. Force save-time net to run on every non-departure day

The save-time block at `action-save-itinerary.ts:422` already runs unconditionally per day. Audit and tighten:

- Drop the `nonLogistics.length > 0` guard or relax it — a day whose only cards are transport is a degenerate edge that still benefits from a hotel-return anchor when it ends mid-evening.
- After `runStep8` runs, log explicit reason when nothing was appended (already exists via `runStep8`'s own `[QUALITY] Skipped hotel return injection on Day N`).

### 3. Tighten the post-meal-guard retry gate (`action-generate-trip-day.ts` ~1804)

Verify and ensure `runStep8` runs when:
- Step 8 was deferred earlier (track via `metadata.quality.step8_deferred = true`), AND
- The day still lacks a hotel-return terminal card.

Currently the retry appears gated on meal injection success; should instead be gated on "Step 8 was previously deferred". One-liner: set the deferral flag in `universal-quality-pass.ts:404` and read it here.

### 4. Add scenario coverage (`supabase/functions/generate-itinerary/__tests__/hotel-return-bookend.test.ts`)

Three new fixtures:
- Day ending 00:10 with `nightcap` title — bookend present, **not** stripped by predawn pass.
- Day ending 22:55 with `nightcap` title and dinner-required defer — bookend appended by save-time net.
- Day ending with `Freshen up at <Hotel>` mid-evening — no duplicate bookend (current behavior preserved).

### 5. Memory update

Append a new constraint:
> **Predawn-Strip Source Allowlist** — `stripPreDawnHotelReturns` MUST exempt cards tagged `source='late_nightlife_bookend'` (or `tags` containing same). Otherwise the legitimate post-midnight return injected by `runStep8`'s late-nightlife branch is eaten by the very next pass. Sentinel: `[predawn-strip] day=N kept N cards (skipped:K late_nightlife_bookend)`.

## Out of scope

- Not introducing a brand-new `appendHotelReturn` function — `runStep8` already exists and is wired correctly. Replacing it would duplicate logic and break the 4 call-site contract.
- Not touching the at-hotel detection (Madrid Day 2 "freshen up" / Florence Day 3 "freshen up at hotel") — already correct via `lastCat==='ACCOMMODATION'`.
- Not changing departure-day handling — already covered by `dayIndex < totalDays - 1` gate.

## Verification

1. Re-run Florence/Barcelona/Madrid scenario tests in `scenario.test.ts`.
2. Manual DB query after re-generation:
   ```
   psql -c "SELECT day, last_title, last_end FROM (...) WHERE last_end > '21:00';"
   ```
   Every non-departure day should have a `Return to <Hotel>` row as the final activity.
3. Console grep for `[predawn-strip]` lines to confirm `late_nightlife_bookend` cards survive.