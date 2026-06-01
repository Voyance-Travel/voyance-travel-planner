## What's broken

Clicking **Regenerate Day** on the Barcelona trip fails:

1. `spend-credits` charges `regenerate_day` successfully (30 credits debited via `credit_ledger`).
2. `generate-itinerary` (action `generate-day`) immediately returns **403 GENERATION_NOT_AUTHORIZED** — "No proof-of-charge … action=generate-day".
3. Frontend issues a refund, but the original spend never returned a `pendingChargeId`, so refund logs `refundAmount: 0` and the user is left charged with nothing generated.
4. A follow-up `Duplicate spend request blocked` fires from React re-render — cosmetic side effect of the same failure.

## Root cause

`spend-credits/index.ts` only writes a `pending_credit_charges` row for **HIGH_VALUE_ACTIONS**:

```ts
const HIGH_VALUE_ACTIONS = ['trip_generation', 'smart_finish', 'hotel_optimization', 'regenerate_trip'];
```

`regenerate_day` is **not** in that list, so no `pending_credit_charges` row is created — only a `credit_ledger` row with `metadata.status='committed'`.

But the proof-of-charge gate in `generate-itinerary/index.ts` queries **only** `pending_credit_charges`:

```ts
.from('pending_credit_charges')
.select('id, status, action, created_at')
.in('action', allowedSpendActions)
.in('status', ['pending','completed'])
```

The durable-ledger-proof fallback at L238 is gated on `action === 'generate-trip'` AND `isUnfinishedTrip`, so it doesn't help `generate-day` / `regenerate-day`. Result: every Regenerate Day click 403's after charging the user.

## Fix

Extend the existing durable-ledger-proof branch to also cover `generate-day` and `regenerate-day` — accepting a `credit_ledger` row with:
- `user_id` + `trip_id` match
- `action_type` in `allowedSpendActions` (already includes `regenerate_day`, `unlock_day`, `regenerate_trip`, `trip_generation`)
- `transaction_type='spend'`, `credits_delta < 0`
- `metadata->>status = 'committed'`
- `created_at >= now() - 10 minutes` (matches the existing pending-charge window)

This mirrors the pattern already shipped for `generate-trip` retry/resume and adds zero new tables, no new spend-credits writes, and no behavioral change for paths that already succeed.

### File edits

**`supabase/functions/generate-itinerary/index.ts`** — proof-of-charge block (around L229–L277):

- Lift the durable-ledger fallback out of the `action === 'generate-trip'` + `isUnfinishedTrip` branch.
- Run it for any `PAID_GENERATION_ACTIONS` when `chargeRes.data` is null.
- Keep the existing trip-unfinished branch as-is (it's the broader umbrella for `generate-trip`); add a sibling branch for `generate-day` / `regenerate-day` that does NOT require unfinished-trip state (regenerating a day on a finished trip is the whole point).
- Same 10-minute window, same `committed` filter, same log line shape.

No frontend changes. No DB migration. No change to `spend-credits` (so `regenerate_day` stays a single-write ledger action — no spurious `pending_credit_charges` rows).

### Out of scope

- "Flight sync failed" console line — separate path (`FlightSyncWarning`), no user-visible failure tied to this trip; treat as a follow-up if it reproduces.
- "Duplicate spend request blocked" — cosmetic side effect of the 403 retry path; goes away once the 403 is fixed. Will re-evaluate if it persists after deploy.
- The `dedupeKey` in `useSpendCredits` missing `dayIndex` is a latent issue (back-to-back regen of different days could collide) but not what's biting here; logged for later.

### Verification

1. Deploy `generate-itinerary`.
2. Click Regenerate Day on the Barcelona trip.
3. Expect: 200 from `generate-itinerary`, day regenerates, no refund issued, console clean.
4. Edge logs: `[generate-itinerary] Durable proof-of-charge OK via committed ledger=… action=regenerate_day` followed by normal generation logs.
