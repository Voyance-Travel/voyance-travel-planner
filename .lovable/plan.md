

## Fix: Budget and Payments Tab Alignment

### Current State

Both **BudgetTab** and **PaymentsTab** already use `useTripFinancialSnapshot` which reads from the `activity_costs` table — they share the same data source. Many of the fixes in the prompt are **already implemented**:

- **Fix 2** (dual-sync): `syncBudgetFromDays` already syncs to `activity_costs` (lines 1394-1448)
- **Fix 3** (flight/hotel on load): Already syncs flight/hotel to `activity_costs` on page load (lines 1458-1486)
- **Fix 4** (chat sync): `ItineraryAssistant.tsx` already syncs to `activity_costs` after chat edits (lines 449-484)

### Remaining Issue

**PaymentsTab line 225** — when `activity_costs` table is empty or stale (e.g., fresh trip load before sync completes), `financialSnapshot.tripTotalCents` returns 0. The current code:

```typescript
const estimatedTotal = financialSnapshot.loading ? payableTotalCents : financialSnapshot.tripTotalCents;
```

Shows `$0` total once loading finishes, even though `payableItems` correctly lists flights, hotels, and activities with real costs. The user sees line items totaling thousands of dollars but a "$0 Trip Total" header.

### Fix

**File: `src/components/itinerary/PaymentsTab.tsx` — line 225**

Change:
```typescript
const estimatedTotal = financialSnapshot.loading ? payableTotalCents : financialSnapshot.tripTotalCents;
```

To:
```typescript
const estimatedTotal = financialSnapshot.loading
  ? payableTotalCents
  : (financialSnapshot.tripTotalCents > 0 ? financialSnapshot.tripTotalCents : payableTotalCents);
```

When the snapshot loads successfully with data, use it (canonical source). When it returns 0 (empty `activity_costs`), fall back to `payableTotalCents` — the sum of visible line items — so the total always matches what the user sees.

This is a one-line change that ensures Budget and Payments tabs agree when data is present, and prevents a $0 display when `activity_costs` hasn't been populated yet.

### Files changed

| File | Change |
|------|--------|
| `src/components/itinerary/PaymentsTab.tsx` | Add fallback to `payableTotalCents` when snapshot returns 0 |

