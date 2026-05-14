## Plan: Drop timeless dining cards on departure days

### Confirmed root cause
`supabase/functions/_shared/post-checkout-prune.ts:143` — the loop in `pruneNonLogisticsAfterAirportTransfer` does `if (s === null) continue;`, so any activity without a parseable `startTime` is silently skipped (kept). A dining card with `startTime: undefined` therefore survives every save-time pass; on render it sorts last via `dayChronoKey` and lands visually below the airport-transfer card.

### Patch (single file, single function)

**File:** `supabase/functions/_shared/post-checkout-prune.ts`

1. Add a `DINING_CAT_RE` + `DINING_TITLE_RE` near the existing helpers (lines ~96–115):
   ```ts
   const DINING_CAT_RE = /\b(dining|food|restaurant|breakfast|brunch|lunch|dinner|cafe)\b/i;
   const DINING_TITLE_RE = /^(breakfast|brunch|lunch|dinner)\b/i;
   function isDiningCard(a: any): boolean {
     const cat = String(a?.category ?? a?.type ?? '');
     const title = String(a?.title ?? a?.name ?? '');
     return DINING_CAT_RE.test(cat) || DINING_TITLE_RE.test(title.trim());
   }
   ```

2. Extend `pruneNonLogisticsAfterAirportTransfer` signature to accept an optional `dayNumber` for the sentinel log (callers can omit; default `0`):
   ```ts
   export function pruneNonLogisticsAfterAirportTransfer(
     activities: any[],
     dayNumber: number = 0,
   ): PostCheckoutPruneResult { ... }
   ```

3. Replace the loop body (line 143) so timeless dining cards on a day with an airport-transfer are removed instead of skipped:
   ```ts
   const s = parseHHMMToMin(a?.startTime || '');
   if (s === null) {
     // Timeless card — only prune if it's dining (no parseable startTime).
     // A meal with null startTime on a departure day always lands after
     // the transfer at render time via dayChronoKey, regardless of source.
     if (isDiningCard(a)) {
       console.log(
         `[POST_AIRPORT_PRUNE] day=${dayNumber} dropped timeless dining card "${a?.title || a?.name || '(unnamed)'}" (no parseable startTime)`,
       );
       toRemove.push(a);
     }
     continue;
   }
   const isPostMidnightWrap = s < 5 * 60 && transferStart > 12 * 60;
   if (s >= transferStart || isPostMidnightWrap) toRemove.push(a);
   ```

4. Update the single live caller at `action-save-itinerary.ts:273` to pass the day number it already has in scope (one-line change). Existing call:
   ```ts
   const transferPruneResult = pruneNonLogisticsAfterAirportTransfer(activities);
   ```
   becomes:
   ```ts
   const transferPruneResult = pruneNonLogisticsAfterAirportTransfer(activities, dayNumber);
   ```
   (verify the local var name is `dayNumber` / `dayNum` / `i+1` and pass whichever exists; fall back to omitting the arg if no day number is in scope — log will just say `day=0`).

### Why this is safe

- **Locked rows** still skipped — the `isLocked` guard at line 139 runs before the new branch.
- **Departure-logistics rows** still skipped — `DEPARTURE_ROLES.has(classify(a))` at line 140.
- **Checkout** still skipped — line 141.
- Non-dining timeless cards (e.g. a manually-added activity without a time) remain unaffected — only dining-classified rows are removed when timeless.
- All 4 existing tests in `post-transfer-prune.test.ts` give every fixture a real `startTime`, so they continue to pass; new behavior is additive.

### Acceptance grep verification (after apply)

1. `grep -n "POST_AIRPORT_PRUNE.*timeless dining" supabase/functions/_shared/post-checkout-prune.ts` → 1 hit.
2. `grep -n "no parseable startTime" supabase/functions/_shared/post-checkout-prune.ts` → 1 hit (in log + comment).
3. Re-read function body: `if (s === null) { if (isDiningCard(a)) toRemove.push(a); continue; }` confirms timeless dining is removed when an airport-transfer card is present (the early return at line 129 still gates the whole pass).

### Optional follow-up (only if QA still reproduces)
Add the upstream `[NORMALIZE_DAYS_DINING_AUDIT]` log at the top of `normalizeDays` in `action-save-itinerary.ts` — but ship the prune-side fix first; per the user's note, that's plan B.