

# Fix: credit_ledger Missing Swap Activity Entries

## Root Cause (Confirmed)

The `spend-credits` edge function correctly deducts credits and updates `trip_action_usage` for swaps, but the `credit_ledger` insert **silently fails** every time.

**Why:** The `credit_ledger.activity_id` column is type `uuid`, but itinerary activity IDs are non-UUID strings like `ai-alt-1771174353473-0`, `vicens_001`, `sagrada-001`. When the edge function attempts to insert these as `activity_id`, the database rejects the row. The Supabase JS client returns `{ data: null, error: {...} }` without throwing, so the function continues and returns `success: true` without ever logging the ledger entry.

**Proof:**
- `trip_action_usage` shows 9 swap uses (this table uses `action_type` as text, no UUID issue)
- `credit_ledger` shows 0 swap entries (this table has `activity_id uuid` column)
- All other actions (unlock_day, ai_message, regenerate_day) work because they pass `null` for `activity_id`

## Fix (Single File Change)

**File:** `supabase/functions/spend-credits/index.ts`

In all three places where `credit_ledger` is inserted (free cap path at ~line 344, group cap path at ~line 254, and paid path at ~line 450):

Change `activity_id: activityId || null` to `activity_id: null` and move the raw `activityId` string into the `metadata` JSON object instead.

This ensures:
- The ledger insert never fails due to UUID type mismatch
- The activity ID is still recorded (in metadata) for audit/debugging
- No schema migration needed

## Technical Details

Three insert locations to update in `spend-credits/index.ts`:

1. **Group cap free path (~line 256):** Change `activity_id: activityId || null` to `activity_id: null`, add `activityId` to metadata
2. **Tier free cap path (~line 353):** Same change  
3. **Paid FIFO path (~line 459):** Same change

Additionally, add error checking after each `credit_ledger` insert to log failures:
```text
const { error: ledgerErr } = await supabaseAdmin.from('credit_ledger').insert({...});
if (ledgerErr) console.error('[spend-credits] Ledger insert failed:', ledgerErr);
```

## Verification

After deploying:
- Perform a swap; check `credit_ledger` for a new `swap_activity` row
- Dashboard at `/admin/margins` should show Swap Activity with non-zero uses
- The `metadata` column should contain the activity ID string for reference

