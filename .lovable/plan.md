## P1.4 — `getTripStats` exclusive buckets + `other`

### What the spec changes

Today (`src/services/userAPI.ts:182-277`), the three counts are **independent filter passes**, so a trip can land in multiple buckets:

- `completedTrips` — `status==='completed'` OR `end_date < now`
- `upcomingTrips` — not completed AND (`end_date ≥ now` OR `start_date ≥ now`)
- `draftTrips` — `status === 'draft'` (regardless of dates)

A draft trip with a future `start_date` is counted in **both** `upcoming` and `draft`. There is no catch-all, and the three numbers can sum to more than `totalTrips`.

The spec switches to **mutually exclusive** buckets evaluated in priority order, plus a fourth `other` for trips that match none, plus a DEV sum-equals-total assertion.

### Behavior change to flag

Under the spec's priority (`ended → upcoming → draft → other`):

- A trip with `status='draft'` and future `start_date` → now `upcoming`, no longer `draft`. Profile's "drafts" tile drops; "upcoming" rises by the same amount.
- A trip with no dates and `status='completed'` → now `other` (the spec drops the explicit `status==='completed'` short-circuit). Profile's "completed" tile may drop.
- A trip with no dates and no draft/planning status (e.g. `status='active'`, `'archived'`) → now `other` (was previously invisible).

This is a real visible change on `src/pages/Profile.tsx`. It is also the explicit goal of the ticket (catch the leftovers), but worth naming.

### Plan

1. **Rewrite the bucketing block (lines ~196–218)** as a single mutually exclusive loop:

   ```ts
   const buckets = {
     completed: [] as typeof allTrips,
     upcoming:  [] as typeof allTrips,
     draft:     [] as typeof allTrips,
     other:     [] as typeof allTrips,
   };

   for (const t of allTrips) {
     let key: keyof typeof buckets;
     if (t.status === 'completed' || (t.end_date && parseLocalDate(t.end_date) < now)) {
       key = 'completed';
     } else if (t.start_date && parseLocalDate(t.start_date) >= now) {
       key = 'upcoming';
     } else if (t.end_date && parseLocalDate(t.end_date) >= now) {
       // currently ongoing (started, not yet ended)
       key = 'upcoming';
     } else if (t.status === 'draft' || t.status === 'planning') {
       key = 'draft';
     } else {
       key = 'other';
     }
     buckets[key].push(t);
   }

   if (import.meta.env.DEV) {
     const sum = buckets.completed.length + buckets.upcoming.length + buckets.draft.length + buckets.other.length;
     console.assert(sum === allTrips.length, `[getTripStats] sum ${sum} != total ${allTrips.length}`);
   }
   ```

   Notes vs. the literal spec snippet:
   - Keep `parseLocalDate` (existing util) instead of raw `new Date()` — matches the rest of the file's timezone-safe handling.
   - Preserve today's "completed if `status==='completed'`" short-circuit so post-trip recap counts don't regress on date-less trips.
   - Preserve today's "ongoing trip is upcoming" behavior (`end_date ≥ now` with no future start).
   - Use plain arrays (`buckets.X.length`) — the `count + trips` shape in the spec is unused by the rest of the function.

2. **Update downstream references** to read from buckets:
   - `completedTrips` (variable) → `buckets.completed`
   - `upcomingTrips` (variable) → `buckets.upcoming`
   - `draftTrips` (variable) → `buckets.draft`
   - `completedTrips.length` → `buckets.completed.length`, etc. (lines 221–249, 259–275).

3. **Extend `TripStats` interface** (line 127) with `otherTrips: number` and populate it in the return object so Profile or future pages can read the leftover count. No consumer breaks — purely additive.

4. **No change** to `TripStatsSummary`, `getTripStatsSummary`, or `Profile.tsx`. Profile only reads `completedTrips`/`upcomingTrips`/`draftTrips`/`totalTrips`, which still exist with the same names.

### Verify

- `grep -c "other:" src/services/userAPI.ts` → expect ≥1 (bucket key + `otherTrips: buckets.other.length`).
- DEV console: load Profile, confirm no `[getTripStats] sum != total` assertion fires across a fixture user with mixed statuses.

### Files touched

- `src/services/userAPI.ts` — `TripStats` interface (1 line), `getTripStats` body (~30 lines).

No DB migration, no consumer edits, no UI work.