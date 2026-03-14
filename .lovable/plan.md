

## Fix: Three cascading errors on trip load

### Issue 1 — Self-heal query uses wrong column names (400 Bad Request)

**Root cause:** Line 1042 in `TripDetail.tsx` queries `itinerary_days` for `weather_data` and `activities_data`, but the actual columns are `weather` and `activities`.

**Fix in `src/pages/TripDetail.tsx` (line 1042):**
- Change `weather_data` → `weather`
- Change `activities_data` → `activities`
- Update the row mapping below (lines 1062-1063) to use `row.weather` and `row.activities`

### Issue 2 — Stale pending charge refund fails (spend-credits 400)

**Root cause:** `useStalePendingChargeRefund.ts` line 84-94 calls the REFUND action but doesn't pass `creditsAmount`. The spend-credits function can't determine the refund amount because `trip_generation` isn't in its hardcoded `REFUNDABLE_COSTS` map.

**Fix in `src/hooks/useStalePendingChargeRefund.ts` (line 85):**
- Add `creditsAmount: charge.credits_amount` to the request body so the edge function uses the dynamic refund path.

### Issue 3 — Self-heal metadata correction triggers unnecessary generation resume

This is a downstream effect of Issue 1. Once the self-heal query succeeds, it won't erroneously fail and the trip will load correctly without triggering stalled generation logic.

### Summary

| File | Change |
|------|--------|
| `src/pages/TripDetail.tsx` line 1042 | `weather_data` → `weather`, `activities_data` → `activities` |
| `src/pages/TripDetail.tsx` lines 1062-1063 | Update row references to match |
| `src/hooks/useStalePendingChargeRefund.ts` line 85 | Add `creditsAmount: charge.credits_amount` |

Three single-line fixes across two files.

