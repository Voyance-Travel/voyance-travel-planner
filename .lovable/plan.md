## RS.M13 — Timezone-correct date comparison in getNextTrip

**File:** `src/services/userStatsAPI.ts` (lines 203, 209)

`start_date` is stored as `YYYY-MM-DD` (no timezone). Comparing it to `new Date().toISOString()` mixes a date-only value with a UTC timestamp, which can hide today's trip for users west of UTC late in the day.

### Change

Replace the UTC ISO string with a local YYYY-MM-DD computed via `toLocaleDateString('en-CA')`:

```ts
// Compare local-date to local-date. start_date is stored as 'YYYY-MM-DD'
// (no timezone), so use today's date in the user's local timezone.
const todayLocal = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

const { data: trips, error } = await supabase
  .from('trips')
  .select('id, destination, start_date, end_date')
  .eq('user_id', user.id)
  .gte('start_date', todayLocal)
  .order('start_date', { ascending: true })
  .limit(1);
```

The `now` variable (line 203) is removed since `Date.now()` is still used directly on line 221 for `daysUntil`.

### Verification

`grep -c "todayLocal\|toLocaleDateString('en-CA')" src/services/userStatsAPI.ts` ≥ 2

### Out of scope

- `getTripStats` date comparisons (separate task)
- `parseLocalDate` / `daysUntil` math (already local via `parseLocalDate`)
