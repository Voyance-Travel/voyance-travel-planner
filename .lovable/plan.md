## RS.M12 — Consistent counting in `getTripStats`

Goal: every trip lands in exactly one bucket and `total === planned + completed + drafts + other`. Keep the existing `{ count, trips: TripSummary[] }` return shape and the date-based bucketing.

### Current behavior to preserve (`src/services/userStatsAPI.ts` 88-132)

- Status `'draft'` → drafts.
- Status `'completed'` → completed.
- Otherwise: `start_date > now` → planned, `end_date < now` → completed, else planned.

Today every trip is assigned, so the off-by-one risk is mostly theoretical — but a single bucket of truth + an `other` overflow guarantees the invariant under future status additions.

### Change

1. Replace the imperative push loop with one bucket assignment per trip via a switch-style classifier:
   ```ts
   type Bucket = 'planned' | 'completed' | 'drafts' | 'other';
   const classify = (t: typeof trips[number]): Bucket => {
     if (t.status === 'draft') return 'drafts';
     if (t.status === 'completed') return 'completed';
     if (t.start_date && parseLocalDate(t.start_date) > now) return 'planned';
     if (t.end_date && parseLocalDate(t.end_date) < now) return 'completed';
     if (t.status === 'planning' || !t.status) return 'planned';
     return 'other'; // unrecognized status — surface instead of silently bucketing
   };
   const buckets: Record<Bucket, TripSummary[]> = { planned: [], completed: [], drafts: [], other: [] };
   for (const trip of trips || []) {
     buckets[classify(trip)].push({ id: trip.id, destination: trip.destination, startDate: trip.start_date, endDate: trip.end_date, status: trip.status });
   }
   ```

2. Return shape stays compatible for the three existing buckets, plus `other`:
   ```ts
   return {
     planned: { count: buckets.planned.length, trips: buckets.planned },
     completed: { count: buckets.completed.length, trips: buckets.completed },
     drafts: { count: buckets.drafts.length, trips: buckets.drafts },
     other: { count: buckets.other.length, trips: buckets.other },
     total: (trips?.length) || 0,
   };
   ```

3. Extend the `TripStats` interface (lines 21-25) with `other: { count: number; trips: TripSummary[] }`. Existing consumers reading `planned/completed/drafts/total` keep working unchanged; `other` is additive.

### Verification

- `grep -c "classify\|other: { count" src/services/userStatsAPI.ts` ≥ 1.
- Existing consumers (`useTripStats`, line 309) continue to compile — only adding an optional-feeling field on the type.
- Manual: with statuses `planning`/`completed`/`draft` only, `other.count === 0` and totals match prior behavior.

### Out of scope

- Renaming buckets, surfacing `other` in any UI, or changing date-inference semantics.
- Touching `getCountriesVisited` or other functions in the file.
