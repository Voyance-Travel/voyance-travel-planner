## Root cause (confirmed against the live DB)

The Paris trip (`7ea828ac…`) actually generated cleanly:
- `itinerary_data.days` has **4 days, 32 activities**
- `activity_costs` has **26 rows** ($1,395 activities + $772 dining + $629 transport + $39 cultural)
- Hotel row sits on day 0

The itinerary is **not** empty in the database. What's broken is the **join key between `activity_costs` and the JSON itinerary**:

```
activity_costs rows for day > 0:        26
…whose activity_id exists in itinerary_data.days[].activities[].id:  0
…orphaned:                              26
```

Per-day / per-category counts match exactly between the two sources (3 dining + 3 activity + 3 transport on day 1, etc.) — so the cost rows were written for these activities, but the activity UUIDs got rewritten somewhere in the pipeline (likely a late quality-pass swap or the sync-tables step minting new ids) without updating `activity_costs.activity_id`.

`usePayableItems.ts` (line 338) then enforces an "orphan guard" that **drops every cost row whose activity_id is no longer in the JSON**:

```ts
if (row.activity_id && !activityNameById.has(row.activity_id)) continue;
```

Result: only the day-0 hotel row survives → "All Costs has 1 item, no dining, no activities, no transit." This also explains the **second confirmed occurrence** — both regenerations actually succeeded; the UI just can't see anything past the hotel because of the broken join.

The Budget vs Itinerary total mismatch (€2,296 vs $2,670) is the same root cause downstream: the per-category breakdowns read activity_costs through the same path, see only the hotel, and report `$0 / $1,890` for every category. The $270 gap is the misc reserve, which one view folds in and the other doesn't — but that's a cosmetic side-effect; with the join fixed, both totals will reflect the real ~$2,800 in costs and the reserve question becomes a separate (smaller) ticket.

## Fix — two layers (defense in depth)

### Layer 1 (frontend, ships immediately): replace orphan-drop with orphan-rescue

In `src/hooks/usePayableItems.ts`, instead of silently dropping any orphaned `activity_costs` row, rescue it by matching on `(day_number, category)`:

1. Build `orphanRescueByDayCat` (already exists for naming) into a structured queue: each `(day, category)` slot holds the live JSON activities in order.
2. When a row's `activity_id` is missing from `activityNameById`:
   - Pop the next live activity for `(row.day_number, mappedCategory)`.
   - If found → use that activity's id + name + json cost lookup, and treat the row as matched.
   - If no live activity remains for that slot → keep current behavior (drop), since it's a true leftover from a prior version.
3. Apply the same rescue to the transit grouping branch so taxi rows surface under the right day.
4. Add a one-line `console.warn` when rescue fires, with `{ tripId, dayNumber, category, rescuedName }`, so we can detect future regressions without burying users in toasts.

This restores the All Costs list, the per-day badges, the Budget category breakdowns, and Trip Total — all from data that already exists in the DB. No regeneration required for any trip currently in this state.

### Layer 2 (backend, prevents future occurrences): keep activity_id stable

In `supabase/functions/generate-itinerary/`:

1. In `action-save-itinerary.ts`, after the quality-pass / placeholder-replacement passes finish, **before** `activity_costs` rows are written, run a final pass that snapshots the post-mutation `itinerary_data.days[].activities[].id` and uses *those* ids when inserting cost rows.
2. In `action-sync-tables.ts`, when populating `itinerary_activities`, preserve the JSON `id` as the row's `id` rather than minting a fresh uuid. (Today the JSON has 32 activity ids but `itinerary_activities` has 58 rows, which confirms the table is being topped up with extra/regenerated ids.)
3. Add a save-time invariant check: after writing both tables, log a warning if `activity_costs.activity_id` ⊄ `itinerary_data` ids. Cheap, catches the next regression in observability before users see it.

### Layer 3 (data heal, optional one-shot)

A one-time SQL migration that, for trips with `itinerary_status='ready'` and orphaned cost rows, repoints each `activity_costs.activity_id` to the live JSON activity matching `(trip_id, day_number, category, ordinal)`. Same logic as Layer 1, run once server-side. Only worth doing if more than this single Paris trip is affected — I'll check the population scope before recommending it.

## Verification steps

After Layer 1 ships:
- Reload the affected Paris trip; the All Costs view should show ~26 line items and category breakdowns ≈ $1,395 / $772 / $629 instead of $0 / $0 / $0.
- The Itinerary header total and Budget tab total should both land within ~$5 of each other (small delta is the misc reserve, addressable separately).
- Generate a fresh trip; verify in the Network tab that `activity_costs.activity_id` values match `itinerary_data.days[].activities[].id` values (Layer 2 working).

## Out of scope for this plan

- The €2,296 vs $2,670 reserve-folding inconsistency — flagged as a follow-up after Layer 1 reveals the true totals.
- The "second confirmed occurrence" wording in the bug report: with the join fixed, both regenerations will retroactively show correct data.
