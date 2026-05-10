# Barcelona Diagnosis — Ship B1, B2, B3

Three bugs from the Barcelona run. B1 and B2 are regressions in existing pipelines; B3 is new. All work is in `supabase/functions/generate-itinerary/` — no frontend changes.

---

## B1 — Meal injection actually fires (CRITICAL)

**Symptom:** Barcelona day scored 45/100 with 5 named meal violations. Florence ~80% meal coverage, Barcelona ~30%. Detection works (`personalization-enforcer.ts` raises `missing_meal`, health engine surfaces it), but the meal-guard injector in `day-validation.ts` (tag `meal-guard`) isn't deterministically reaching every day.

**Root causes to address:**

1. **Policy-cache gap on multi-day path.** `action-generate-trip-day.ts` writes `metadata.quality.meal_policy_at_generation` per day (lines 1827, 2374), and `action-save-itinerary.ts` reads it (line 305) to decide whether to re-run meal-guard at save time. The full-trip path (`action-generate-trip.ts` / `action-generate-full.ts`) does not consistently write this metadata, so save-time meal-guard short-circuits and Barcelona escapes with no injection. Mirror the same write into the full-trip pipeline so every persisted day carries the policy snapshot.
2. **Meal-guard not always invoked post-generation.** `action-generate-trip-day.ts:1704` runs a belt-and-braces meal-guard per day. The equivalent block is missing from the multi-day full-trip generator. Add the same per-day meal-guard call after each day is produced, before universalQualityPass Step 8 hotel-return injection (Step 8 already defers when dinner is required-but-missing).
3. **Prompt under-specifies meal density.** `compile-prompt.ts` lists meals as guidance, not as a hard requirement keyed to dayMode. Add an explicit `HARD REQUIREMENT — MEALS` block with the late_arrival / early_departure / midday_arrival / normal branches and an explicit ban on "snack inside another activity counts as a meal."

**Files touched:**
- `supabase/functions/generate-itinerary/action-generate-trip.ts` and/or `action-generate-full.ts` — write `metadata.quality.meal_policy_at_generation` per day; invoke per-day meal-guard then re-run Step 8 (mirrors `action-generate-trip-day.ts:1704–1827`).
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — `HARD REQUIREMENT — MEALS` block.
- `supabase/functions/generate-itinerary/day-validation.ts` — confirm meal-guard returns injected meal cards even when a non-meal activity overlaps the canonical slot (fallback DB ordering, not new logic).

**Verification:**
- Generate 3-day Barcelona (normal arrival + 15:30 departure on Day 3). Every day has breakfast/lunch/dinner cards; Day 3 has breakfast + lunch only.
- Health score ≥ 80; `personalization-enforcer` reports zero `missing_meal`.
- Log line `[generate-trip] post-meal-guard meals injected=N` present on every day.

---

## B2 — Hotel-return on every non-departure day

**Symptom:** Barcelona Day 2 ends at Paradiso Speakeasy 00:20; no hotel-return appended.

**Root cause:** `runStep8` in `universal-quality-pass.ts:83` only injects a hotel-return when the last activity ends `14:00–23:59` (line 102). A speakeasy ending at 00:20 falls outside that window and is silently skipped (line 105 logs the skip). The window was designed to suppress pre-dawn phantoms but doesn't handle legit post-midnight nightlife.

**Fix:**
- Extend `runStep8` to accept `endTime` in `00:00–02:30` **only when** the prior activity's `category` is nightlife/bar/entertainment AND `start_time` ≥ 21:00 (i.e., a continuous late-evening session that bled past midnight). In that case, anchor the return-to-hotel transit at the speakeasy end-time and clamp via existing `clampBookendEndTime` (Day-End Hotel-Return Bookend memory: clamp ≤ 23:59 has to be relaxed for this case — emit the card with same-day end-time even if it spills, OR record it on the following day's activities[0] as `accommodation`). Pick same-day with `endTime` clamped to last activity end + 25min and let UI's existing ghost-hotel filter handle the bleed.
- Confirm `shouldAppendHotelReturn`-style preconditions: skip if departure day, skip if last activity is already accommodation/hotel_return, skip if last activity is airport/station transport. These exist implicitly; tighten into a single guard.
- Default `transitMode = 'taxi'` for late-night (after 22:30) returns, with cost from existing taxi cost helper.

**Files touched:**
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — relax `runStep8` time-floor; add late-nightlife branch.
- `supabase/functions/generate-itinerary/__tests__/hotel-return-bookend.test.ts` — add Day 2 / 00:20 nightlife case.

**Verification:**
- Florence Day 1 nightlife case (existing test) still passes.
- New test: speakeasy 22:30–00:20 → repair appends taxi return ~00:25–00:50, marked transport/hotel_return.
- Airport transfer last activity → no hotel-return appended.
- Departure day → no hotel-return appended.

---

## B3 — Per-category price sanity check (NEW)

**Symptom:** Pastelería Hofmann (pastry shop) priced at €120/pp for breakfast. Real range €5–25. AI hallucinated or cross-contaminated from Hofmann's tasting-menu restaurant.

**Plan:**

1. **Add `CATEGORY_PRICE_CEILINGS` table** in a new shared file `supabase/functions/generate-itinerary/_shared/category-price-bounds.ts` with `{min, max, currency: 'USD'}` per subcategory (pastry, coffee_shop, breakfast_casual, lunch_casual, lunch_mid, lunch_fine_dining, dinner_casual, dinner_mid, dinner_fine_dining, walking_tour, museum, guided_tour_premium, metro_ticket, taxi_short, taxi_airport). Use values from the prompt brief verbatim.
2. **Add `inferSubcategory(activity)` helper** in the same file. Uses `category` + meal slot + keyword regex over title/venue_name (`pastr|bakery|patisserie` → `pastry`; `michelin|tasting menu|chef.{0,3}counter` → `*_fine_dining`; `coffee|café|espresso` → `coffee_shop`; etc.). Returns `null` for unknown — checks are skipped, never throw.
3. **Add `checkPlausiblePricing(day)` validator** in `pipeline/validate-day.ts`. Returns `PRICE_IMPLAUSIBLE` (severity `error`) or `PRICE_TOO_LOW` (severity `warning`) violations with `{activityId, subcategory, observed, ceiling}` metadata. Skip rows where `cost.basis` is `user|user_override|booked` (respect Universal Locking + user overrides). Skip walking legs ($0 by policy) and verified Michelin rows (existing fine-dining floor logic in `sanitization.ts` already handles them — defer to those tiers).
4. **Add `repairImplausiblePricing(day, violations)` in `pipeline/repair-day.ts`.** Step order: run after §10b sanitization, before validation gate. Behavior:
   - For `PRICE_IMPLAUSIBLE`: substitute median `(min+max)/2`, write to `cost.amount` AND mirror to `price_per_person` / `estimated_price_per_person` / `price` (table-driven cost-architecture parity per `cost-repair-jsonb-parity` memory). Set `cost.priceSource = 'category_median_substitute'`, store `cost.originalAmount` for audit. Log `[REPAIR_PRICE_SUBSTITUTE] day=N venue=… subcat=… orig=… median=…`.
   - For `PRICE_TOO_LOW`: leave as-is, surface only in repair telemetry (no auto-bump — could mask legit cheap finds).
5. **Mirror into `action-repair-costs.ts`** so the standalone cost-repair entrypoint applies the same ceilings (parity with bar-cap repair parity memory). Same logging sentinel.
6. **Lint guard:** add unit test ensuring fine-dining tasting menus at appropriate venues are not flagged (e.g., Disfrutar €250 dinner_fine_dining stays).

**Files touched:**
- `supabase/functions/generate-itinerary/_shared/category-price-bounds.ts` (new)
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/action-repair-costs.ts`
- New tests: `pipeline/price-sanity.test.ts`

**Verification:**
- Barcelona pastry breakfast: AI returns €120/pp → repair substitutes €14 median, logs `[REPAIR_PRICE_SUBSTITUTE] subcat=pastry orig=120 median=14`.
- Disfrutar tasting menu €250/pp → no flag (under fine-dining €350 ceiling).
- Metro ticket €2.40 → no flag.
- User manually edited a $300 breakfast → respected, no auto-substitute (basis=user).
- `trip_payments` row reflects the substituted amount; `cost_change_log` carries the delta (per silent-repair-attribution memory).

---

## Memory updates after ship

Two new memories to add post-merge:

1. **`mem://constraints/itinerary/meal-guard-policy-cache-parity`** — Full-trip + multi-day paths MUST write `metadata.quality.meal_policy_at_generation` and run post-meal-guard Step 8 retry (mirrors `action-generate-trip-day.ts:1704–1827`). Closes Barcelona 30% meal coverage regression. Sentinel: `[generate-trip] post-meal-guard meals injected=N` on every day.
2. **`mem://constraints/itinerary/per-category-price-sanity`** — `CATEGORY_PRICE_CEILINGS` + `checkPlausiblePricing` validator + `repairImplausiblePricing` substitute median; respects basis=user/booked and existing fine-dining floors. Sentinel: `[REPAIR_PRICE_SUBSTITUTE]`. Closes "€120/pp Hofmann pastry" pattern.

Update **Core** index entry for hotel-return: change Day-End Hotel-Return Bookend description to note new late-nightlife window 00:00–02:30 with prior-activity nightlife guard.

---

## Ship order

1. B1 (meal injection parity) — unblocks density score.
2. B2 (hotel-return late-nightlife) — small, isolated.
3. B3 (price sanity) — new, lands behind a feature flag `PRICE_SANITY_ENABLED=true` (env, default on) so we can disable instantly if a category ceiling proves too tight on a luxury archetype.