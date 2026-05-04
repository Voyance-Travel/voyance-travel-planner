## Plan to fix persistent “Reconciling…” in Payments

### What I found
The badge is not a Stripe/payment-session status. It is rendered in `PaymentsTab.tsx` when two different totals disagree:

- `estimatedTotal`: canonical total from `useTripFinancialSnapshot`, mainly `activity_costs` plus manual payments.
- `payableTotalCents`: Payments tab line-item total from `usePayableItems`.

For the active Paris test trip, the database ledger currently totals about **$1,917** in activity costs plus a **$2,400 manual hotel payment**, while Payments can still add extra JSON-walk fallback estimates for itinerary items that are not in `activity_costs`. That fallback was intended to keep uncosted visible activities from disappearing, but it makes the visible payment rows drift from the canonical ledger, so the badge stays “Reconciling…” across sessions.

### Fix
1. **Make Payments totals ledger-first**
   - Update `usePayableItems` so the Payments tab does not add estimated JSON-walk fallback rows into the grand total by default.
   - Keep the existing DB-backed rows, manual expenses, hotel/flight inclusion toggles, transit grouping, and orphan payment recovery.
   - This makes the Payments tab total use the same source of truth as Budget/header totals.

2. **Surface missing-cost items without changing the total**
   - For itinerary activities that are visible but missing a real `activity_costs` row, show them as “Not priced yet” / `$0 pending pricing` rather than estimating and adding them to the total.
   - Do not show truly free or excluded rows: walking, accommodation rituals, flights, known free public venues, placeholder airport transfers.
   - This preserves transparency without silently inflating the Payments total.

3. **Replace the sticky “Reconciling…” badge**
   - Remove the permanent amber “Reconciling…” label from the header.
   - If totals match, keep the positive “Matches itinerary” indicator.
   - If there is still a larger mismatch, show a clearer one-line diagnostic such as “Payment rows differ by $X” in dev/diagnostic contexts, instead of a vague persistent status that looks like a stuck payment process.

4. **Clean up dead comparison logic in `PaymentsTab.tsx`**
   - Simplify comments and logic around `estimatedTotal`, `payableTotalCents`, and mismatch detection.
   - Ensure the top “Trip Total”, paid/unpaid math, budget progress, and split/person calculations all continue to use the canonical total.

5. **Verify against current Paris test data**
   - Confirm the active trip no longer shows “Reconciling…”.
   - Confirm the Payments trip total aligns with the ledger-backed total and does not include ad-hoc JSON estimates.
   - Confirm All Costs still shows paid/manual rows and visible DB-backed activities correctly.

### Files to change
- `src/hooks/usePayableItems.ts`
- `src/components/itinerary/PaymentsTab.tsx`

No database migration is required for this fix.