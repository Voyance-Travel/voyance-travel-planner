

## Fix: Flight Form Fields Overlapping on Mobile in Start.tsx

The flight form on the `/start` page has **5 remaining instances** of `grid grid-cols-2 gap-3` that need the responsive breakpoint. The Date/Time rows were already fixed in a previous pass, but the Route and Airline rows were missed.

### Exact changes in `src/pages/Start.tsx`

All are the same one-word fix: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`

| Line | Field Pair | Section |
|------|-----------|---------|
| 1213 | From / To | Outbound flight route |
| 1273 | Airline / Flight # | Outbound flight details |
| 1331 | From / To | Connection leg route |
| 1398 | Airline / Flight # | Connection leg details |
| 1454 | From / To | Return flight route |

That's it — 5 class string changes, no new code, no structural changes.

The Date/Departs/Arrives rows (lines 1233, 1357, 1472) already use the correct `grid-cols-2 sm:grid-cols-3` pattern, so they're fine.

