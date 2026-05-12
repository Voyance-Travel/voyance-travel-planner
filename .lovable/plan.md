### Status read on the 8 items you raised

| # | Issue | Has it been touched? | Verdict |
|---|---|---|---|
| 1 | Day 2 hotel-return appearing on Mallorca/Day 2 | Yes — `runStep8` 14:00 floor, late-nightlife branch, predawn-strip allowlist, source-survival, AM/PM parser, read-time bookend | Improving as you observed; inconsistency is mostly the source-tag dropping somewhere along persist/parse. Not "fixed". |
| 2 | Inline gap warning banner ("Suggest something") | Yes — `detectGapsForDay` + `TripHealthPanel` ghost-reading filter | Working as intended. |
| 3 | Day 1 breakfast missing across 5 cities | **No targeted fix has shipped.** The Day-1 arrival band rule exists in prompt + memory, but there's no deterministic post-gen guarantor. Still a prompt-only constraint, which is why it leaks. | **Open.** |
| 4 | Day 3 floating no-time dinner card | Partially — `fillMissingStartTimes` fills `startTime = endTime − duration`. It only triggers when `endTime` AND `durationMinutes` both exist. If neither is set on a dining card, it still floats. | **Open for the no-time-at-all variant.** |
| 5 | "Loading… / Finding restaurant…" stuck spinner | Yes — `RestaurantLink.tsx` now has a 5s `setTimeout` deadline armed before the async invoke (last loop). | Fix is in code. If you still see it after a fresh deploy, the dev console will print `[RestaurantLink] lookup deadline hit (5s)` — that distinguishes "edge fn hangs" from "component remounts". Need that signal to confirm. |
| 6 | Midnight orphan card at top of next day | Yes — `dayChronoKey` wrap-aware sort + `BOOKEND_REORDER` legacy reorder + `ensureHotelReturnBookend` allowlist | Should be fixed for new saves; legacy trips self-heal on next save. If still seen, it's a parser path that bypasses `dayChronoKey`. |
| 7 | Hong Kong CNY instead of HKD | **No.** No destination→currency resolver exists in shared code (`exchange-rates.ts` only holds rates). HK is being inferred from country=China upstream somewhere. **New regression, untouched.** | **Open.** |
| 8 | Venue curation strong | N/A | Keep. |

### Plan — fix the four still-open items (no over-scoping)

1. **Hong Kong currency (#7) — highest user-trust hit, smallest fix.**
   - Add `_shared/destination-currency.ts` with an explicit map for the SARs and known exceptions (HK→HKD, Macau→MOP, Taiwan→TWD, Puerto Rico→USD, etc.) layered on top of country→currency.
   - Wire it into the cost-snapshot writer (`writeActivityCostsFromItinerary`) and the budget snapshot reader so HK trips stop inheriting CN currency.
   - Backfill: one-shot repair pass for any active trip where `destination` matches HK and `currency` is CNY.

2. **Day-1 breakfast guarantor (#3) — deterministic, not prompt.**
   - In `repair-day` after the meal-guard, add a Day-1-specific rule: if arrival band <10:30 AND no breakfast/brunch card exists in the morning window, inject one from the city's verified breakfast pool (same fallback DB the meal-guard already uses).
   - Sentinel `[DAY1_BREAKFAST_INJECT]`. No new prompt rules.

3. **Floating no-time dinner card (#4).**
   - Extend `fillMissingStartTimes` so a dining card with neither `startTime` nor `endTime` gets assigned the canonical dinner slot (19:30 default, or 20:00 luxury) when it's the only dinner of the day. If a dinner with a time already exists, drop the timeless duplicate.
   - Add a save-time net in `action-save-itinerary normalizeDays`.

4. **RestaurantLink spinner verification (#5).**
   - The code fix is in place. To close the loop, add one production-safe info log on the timeout-fire path (not dev-only), so if it still spins we'll see it in BrowserConsole. If we see `[RestaurantLink] lookup deadline hit` repeatedly, the next step is to short-circuit the `lookup-restaurant-url` invoke with an `AbortController` so the fetch is actually killed (not just the UI state cleared) — currently the hung invoke can hold a connection open and block other invokes on the same channel.

5. **Hotel-return inconsistency (#1) — observe before patching.**
   - Add structured telemetry that logs, per day, whether a bookend was emitted, by which source, and whether it survived to the persisted JSON. Don't change generation logic this round. Once we have one trip's worth of `[BOOKEND_TRACE day=N source=… survived=true|false]`, we'll know exactly which leak is left.

### Out of scope this round
- Re-tuning the meal-pacing prompt (all four open items above are deterministic-pass fixes, not prompt fixes).
- Touching the gap-banner UI (#2) or venue curation (#8) — both are working.