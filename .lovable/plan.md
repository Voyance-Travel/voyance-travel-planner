## Two deferred items — scoped plan

### 1. Day-1 breakfast guarantor (deterministic post-gen)

**Where it goes**
`supabase/functions/generate-itinerary/action-generate-trip-day.ts`, immediately after `enforceRequiredMealsFinalGuard` runs and before the post-meal-guard `runStep8` retry.

**Trigger conditions (all must be true)**
- `dayNumber === 1`
- Meal policy resolved via `deriveMealPolicy` includes `'breakfast'` in `requiredMeals` (covers morning_arrival <06:30 + full_exploration; correctly skips midday/late arrivals where breakfast isn't expected)
- No card in the day with category ∈ {breakfast, brunch, cafe} OR title matching `/\b(breakfast|brunch)\b/i` whose `startTime` falls in 06:30–10:30
- Arrival band (if first-day flight known) is <10:30; otherwise default to true when `requiredMeals` includes breakfast

**What it does**
1. Pull the city's verified breakfast pool — reuse the same source the meal-guard uses:
   - First: `verified_venues` filtered by destination + `types` containing breakfast/cafe/bakery (`checkVenueCache` style query, but pool-fetch variant)
   - Fallback: `INLINE_FALLBACK_BREAKFAST` map per city in `_shared/fallback-meals.ts` (already exists for meal-guard)
2. Pick first unused venue (skip any name already present elsewhere in trip via cross-day dedup canonicalizer)
3. Construct activity card:
   - `startTime` = arrival+90min clamped to [08:00, 09:30], default 08:30
   - `endTime` = start+75min
   - `category: 'breakfast'`, `mealSlot: 'breakfast'`
   - `source: 'day1_breakfast_inject'` (new sentinel tag, allowlisted in ghost filter)
   - Description filled by `_shared/description-fill.ts` (already runs post-guard)
4. Insert via timing-cascade-aware splice (not naive push) so subsequent activities re-cascade
5. Log `[DAY1_BREAKFAST_INJECT] day=1 dest=… venue="…" source=verified|fallback`

**City pool integrity (cross-city guard)**
- Reuse `detectCrossCityMention` on selected venue name + address before inserting
- If pool exhausted or all rejected → emit `needsVenuePick` $0 sentinel (consistent with wellness pattern)

**Files touched**
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — new helper call
- `supabase/functions/_shared/day1-breakfast-inject.ts` — NEW, contains the helper
- `supabase/functions/_shared/fallback-meals.ts` — verify breakfast pool exists per city; extend if gaps
- `src/lib/itinerary/hideGhostActivities.ts` — allowlist `source:'day1_breakfast_inject'` (no-op since real venue, but future-proof)

**Test coverage**
- `_shared/__tests__/day1-breakfast-inject.test.ts`:
  - morning arrival, no breakfast → injects
  - morning arrival, breakfast already present → no-op
  - midday arrival (12:30) → no-op (policy excludes breakfast)
  - late arrival (22:00) → no-op
  - exhausted pool → unverified placeholder
  - cross-city venue rejected, falls through

**Out of scope**
- Lunch/dinner equivalents (meal-guard handles them)
- Re-tuning prompt rules

---

### 2. Hotel-return survival telemetry (observation only)

**Goal**: prove which path drops the bookend before patching. Zero generation logic changes.

**Instrumentation points**
1. **Emission** — `runStep8` (universal-quality-pass.ts) — already logs; standardize to:
   `[BOOKEND_TRACE] day=N stage=emit source=bookend|late_nightlife_bookend|bookend-overnight result=created|skipped reason=…`
2. **Predawn-strip** — `stripPreDawnHotelReturns` — log per-bookend kept/stripped with source:
   `[BOOKEND_TRACE] day=N stage=predawn-strip source=… result=kept|stripped`
3. **Clamp** — `clampAllBookends` — log when endTime clamp fires:
   `[BOOKEND_TRACE] day=N stage=clamp source=… clamped=true|false originalEnd=… newEnd=…`
4. **Persist** — `action-save-itinerary normalizeDays` — count bookends entering vs. exiting:
   `[BOOKEND_TRACE] day=N stage=persist in=K out=M dropped=[id1,id2]`
5. **Read-time** — `ensureHotelReturnBookend` (parser) — log when synthetic injection happens:
   `[BOOKEND_TRACE] day=N stage=readtime injected=true|false source=bookend-readtime|late_nightlife_bookend|bookend-overnight reason=…`

**Single-line aggregator (post-save)**
At end of `action-save-itinerary`, emit one summary line per day:
```
[BOOKEND_SUMMARY] tripId=… day=N emitted=Y stripped=N clamped=Y persisted=Y readtimeInjected=N finalSource=…
```

**Files touched**
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — standardize existing logs
- `supabase/functions/_shared/clamp-bookend.ts` — add stage tag to existing logs
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — add in/out counter + summary
- `src/lib/itinerary/ensureHotelReturnBookend.ts` — add readtime stage log

**No behavior change**: all `[BOOKEND_TRACE]` lines are pure `console.log`. Zero risk of regression.

**Exit criteria**
After one trip passes through, grep edge logs for `[BOOKEND_SUMMARY]` and identify whichever day shows `emitted=Y persisted=N` or `persisted=Y readtimeInjected=Y` (= persisted bookend was dropped at parse). That tells us the exact leak before writing a fix.

---

### Sequencing

1. Telemetry first (1 PR, ~30min, zero risk) — ship and let it bake on next user trip
2. Day-1 breakfast guarantor (1 PR, ~90min, deterministic) — independent, ship in parallel
3. Once telemetry produces one `[BOOKEND_SUMMARY]` showing the leak, write the targeted bookend-survival fix in a third PR

Shall I proceed with this plan, or adjust the breakfast injection window / telemetry verbosity first?
