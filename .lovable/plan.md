## Problem

`useTripFinancialSnapshot` fires a `toast.warning("Trip total changed by ±$X")` whenever the recomputed trip total deviates from the previous fetch by more than 25%. On Casablanca / Amsterdam / Sapporo it fires on tab switch with no user action. The existing silent-suppression machinery (`suppressNextToastRef`) covers some paths, but it can't reliably catch every system-reconcile race because:

- The hook is instantiated per-consumer (PaymentsTab, EditorialItinerary, BudgetTab, TripTotalDeltaIndicator) — each has its own listener, suppress flag, and inflight `fetchData`.
- Async RPCs inside `fetchData` (`archive_orphan_trip_payments`, `sync-trip-cost-table`) dispatch their own follow-up `booking-changed` events later. Multiple parallel instances + late dispatches create races where the suppress flag is consumed by one fetch while another fetch's delta check still runs unsuppressed.
- The attributed toast (`Pricing updated: …`) at line 524 ignores the suppress flag entirely — so even when the unattributed branch is correctly suppressed, the attributed branch can still pop on a system reconcile.

The unattributed toast ("Tap to see what changed") provides no actionable information — it's pure noise. Per the user's preference on recurring intermittent bugs, remove it rather than continue patching the suppression race.

## Changes

**`src/hooks/useTripFinancialSnapshot.ts`** (delta-check block, ~lines 484–553):

1. Delete the unattributed `toast.warning("Trip total changed by ±$X")` block. Keep the `console.warn` so the diagnostic signal stays in console logs.
2. Gate the attributed `toast.info("Pricing updated: …")` branch on `!suppressed` so system-reconcile passes (orphan-archive, backfill, expire-stale, payments-tab-mount) never surface it either.
3. Keep `suppressNextToastRef` machinery, the listener re-arm logic, and the `lastWarnedTotalRef` dedupe — they still protect the attributed toast.
4. Update the `// else if (suppressed && ratio > 0.25)` info-log so it logs whether the suppressed event would have been attributed or generic, for forensic clarity.

**File header docstring** (lines 18–19): replace the "Logs a console.warn + toast when a single refresh jumps the total by >25%" line with "Logs a console.warn on >25% jumps; only fires a toast when the change can be itemized via cost_change_log AND was not a system-reconcile."

## Out of scope

- No changes to the cost-repair attribution toast logic itself (still uses `getRecentCostChanges`, still rendered with the same copy when it does fire).
- No changes to PaymentsTab dispatch sites or `safeUpdateItineraryData` write boundary.
- No changes to memory entries until after the user confirms this lands cleanly (then update `mem://constraints/finance/silent-system-reconcile-toast` to note the unattributed toast has been removed and the attributed toast is suppressed too).

## Risk

Low. The unattributed toast has no actionable info — removing it loses no signal the user can act on. The console.warn remains for engineering. Real attributed pricing-change events (e.g., a cost-repair pass after a chat edit) still surface, just gated by the silent flag now so they don't pop on tab switches.
