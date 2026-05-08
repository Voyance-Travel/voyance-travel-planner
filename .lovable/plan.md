# Three Consistent Bugs — Root-Cause Plan

## 1. Ghost hotel return bleeding past midnight (every run)

**Root cause.** `clamp-bookend.ts::isBookendCard()` requires either:
- `category ∈ {accommodation, stay, hotel}` AND title matches `return/back/freshen-up/...`, OR
- `category ∈ {transport, transportation}` AND title/`location.name` contains the literal word **"hotel"**.

The failing card is `"Walk to JW Marriott"` with `category=transport`. Title says "JW Marriott" — not "hotel". `location.name` is the hotel's proper name. So `isBookendCard()` → `false` → no clamp → endTime = 12:28 AM bleeds. The display-side `hideGhostActivities.ts::HOTEL_RETURN_RE` has the same flaw — it also requires the literal substring "hotel". Both regexes miss every real hotel name (Marriott, Cipriani, Gritti, Aman, etc.).

**Fix.** Make "is this a hotel-bookend?" hotel-name-aware, not literal-word-aware.

- Add a shared `isHotelLikeText(text, hotelContext?)` helper in `_shared/clamp-bookend.ts` that returns true when text contains the active trip's hotel name (passed in via `opts.hotelName`) OR matches an expanded brand regex (`marriott|hilton|hyatt|ritz|four seasons|st\.?\s*regis|peninsula|aman|belmond|cipriani|gritti|danieli|jw\s+marriott|ihg|kempinski|rosewood|park hyatt|mandarin|raffles|bvlgari|conrad|edition|w\s+hotel|hotel\b`).
- Update `isBookendCard()` transport branch to use `isHotelLikeText` instead of `.includes('hotel')`.
- Mirror the change in `src/lib/itinerary/hideGhostActivities.ts::HOTEL_RETURN_RE` (or add a brand-aware companion check) so persisted bleeds get hidden client-side until the next regen.
- Thread `hotelName` into the three repair-day clamp call sites and into `clampAllBookends` in `persist-day.ts` / `action-save-itinerary.ts` so brand matching stays trip-specific.
- Add a Deno test: card `{title:"Walk to JW Marriott", category:"transport", startTime:"23:50", endTime:"00:28"}` clamps to `23:50–23:59`.

## 2. "Reservation Urgency: ." blank template field (repeats)

**Root cause.** `prompt-leak-scrub.ts::scrubBodyPromptLeaks()` only walks a fixed BODY_FIELDS list (`description, tips, notes, …`). The leak is appearing in *card titles* and as a UI badge — fields like `title`, `name`, `subtitle`, and the AI-side `reservationUrgency` JSON value itself when the model emits the literal label string instead of an enum value (e.g. `reservationUrgency: "Reservation Urgency: ."`). Today:
- `validate-day` only scans body fields → no error raised.
- `repair-day` step 10b only mutates body fields → leak survives in title.
- The DB trigger doesn't currently strip these label-leak patterns from titles.

**Fix.**
- Extend `prompt-leak-scrub.ts` with a separate `scrubTitleLeaks(act)` that runs `RESERVATION_LABEL_LEAK_RE` + `ORPHAN_EMPTY_LABEL_RE` over `title`, `name`, `subtitle`, and `reservationUrgency` (when value is empty, a lone `.`, or starts with `Reservation Urgency:`). When `reservationUrgency` collapses to empty, drop the field entirely.
- Wire `scrubTitleLeaks` into the three existing scrub call sites: `validate-day` (raise `RESERVATION_URGENCY_PROMPT_LEAK` repair tag), `repair-day` step 10b, and `action-save-itinerary.ts` final sweep.
- Update the DB trigger `trips_scrub_prompt_artifacts` to also scrub `activities[].title` / `name` / `subtitle` against the same regex (last gate).
- Mirror in `src/utils/activityNameSanitizer.ts::sanitizeActivityName` so already-persisted dirty titles render clean immediately, before the next regen.
- Add tests covering: orphan `.` in title, populated leak in title, leak in `reservationUrgency` value.

## 3. Michelin pricing mismatch — €26/pp on card vs $500+ in budget

**Root cause.** Two separate code paths compute the floor and only one updates the JSON the card reads:

- `action-repair-costs.ts` (lines 348-419) computes `michelinFloor` and writes the floored amount into the **`activity_costs` table only** (`rows.push({ ... cost: finalCost ... })`). The budget snapshot reads from `activity_costs` → shows $500.
- `itinerary_data.activities[i].cost.amount` is left at the original €26 (the LLM's casual estimate). The card UI reads `activity.cost.amount` → shows €26/pp.

`sanitization.ts::enforceMichelinPriceFloor` does write to all activity field shapes via `writePriceToAllFields`, but it runs at generation time. `action-repair-costs.ts` runs later (after the user opens the trip / on cost-repair triggers) and is the path that actually finds the violations because the generator's first-pass floor sometimes misses them. So the floor lands in the snapshot table but never back-propagates to `itinerary_data`.

**Fix.** Make `action-repair-costs.ts` write to both stores in one transaction:

- After computing `michelinFloor` and pushing the row to `activity_costs`, call the shared `writePriceToAllFields(activity, finalCost)` from `sanitization.ts` on the in-memory activity, then route the mutated `itinerary_data` through `safeUpdateItineraryData` (the same boundary the raw-write fix uses) so all six cost field shapes update on the JSON side.
- Add a server-side parity check at the end of `action-repair-costs`: for each row with `source='michelin_floor'`, assert `activity.cost.amount * 100 === activity_costs.cost_cents` and emit `[REPAIR_PARITY_DRIFT]` if not.
- Add a UI-side reconcile: in `EditorialItinerary.tsx::syncBudgetFromDays` (or the equivalent card price selector), when an activity has a matching `activity_costs` row priced ≥ 4× the JSON `cost.amount`, prefer the snapshot value and show a one-time `cost_floor_applied` badge so the card can never display a stale €26 while the budget shows $500.
- Test: feed a Quadri-shaped activity at €26/pp into `action-repair-costs`; assert both `activity_costs.cost_cents = 12000` AND `itinerary_data.activities[0].cost.amount = 120`.

## Cross-cutting

- Update `mem://index.md` Core entries:
  - Bookend Clamp End of Day → note brand-aware hotel detection.
  - Reservation Urgency Prompt Leak → note title-field coverage.
  - Add a new core line: "Cost-repair writes to activity_costs MUST mirror to itinerary_data.cost.amount via safeUpdateItineraryData; parity-checked post-write."

## Files touched

- `supabase/functions/_shared/clamp-bookend.ts` (brand-aware bookend)
- `supabase/functions/_shared/__tests__/clamp-bookend.test.ts` (new test)
- `src/lib/itinerary/hideGhostActivities.ts` (brand-aware ghost hide)
- `supabase/functions/_shared/prompt-leak-scrub.ts` (+ `scrubTitleLeaks`)
- `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts` (new tests)
- `supabase/functions/generate-itinerary/pipeline/{validate-day,repair-day}.ts`, `action-save-itinerary.ts` (call new scrub)
- `src/utils/activityNameSanitizer.ts` (UI mirror)
- New migration: extend `trips_scrub_prompt_artifacts` trigger to title/name/subtitle
- `supabase/functions/generate-itinerary/action-repair-costs.ts` (write back to itinerary_data + parity check)
- `src/components/itinerary/EditorialItinerary.tsx` (card-vs-snapshot reconcile)
- `mem://index.md` + memory rule files
