## Fix 7.3 — Timezone-aware daysUntil in send-trip-reminders

### 1. Migration: `<ts>_user_timezone_preference.sql`
```sql
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS timezone text;
```
No backfill — null is treated as UTC at runtime.

### 2. `supabase/functions/send-trip-reminders/index.ts`

**a. Add helper** (top of file, after imports):
```ts
function computeDaysUntilLocal(startDate: string, userTimezone: string | null): number {
  const tz = userTimezone || 'UTC';
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date(`${todayLocal}T00:00:00`);
  return Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
```

**b. Restructure the qualifying loop (lines ~405–414).** Currently `daysUntil` is computed in UTC before preferences are fetched. Move the preferences fetch earlier so the tz map is available, then compute per-user:

1. After the `trips` query, collect `userIds = [...new Set(trips.map(t => t.user_id))]`.
2. Fetch preferences once: `.select("user_id, trip_reminders, timezone").in("user_id", userIds).eq("trip_reminders", true)`.
3. Build `tzByUser = new Map(preferences?.map(p => [p.user_id, p.timezone]) ?? [])` and `usersWithReminders = new Set(tzByUser.keys())`.
4. In the qualifying loop, skip trips whose user isn't in `usersWithReminders`, then:
   ```ts
   const daysUntil = computeDaysUntilLocal(trip.start_date, tzByUser.get(trip.user_id) ?? null);
   ```
5. Drop the now-redundant later `preferences` fetch + `filteredTrips` filter (replaced by the upfront one).

### Verify
- `grep -n "computeDaysUntilLocal\|timeZone\|tzByUser" supabase/functions/send-trip-reminders/index.ts` → 4+ hits
- `grep "timezone" supabase/migrations/*user_timezone_preference*.sql` → 1 hit