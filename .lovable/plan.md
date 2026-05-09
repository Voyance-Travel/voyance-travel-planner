## Fix 7.2 — send-trip-reminders idempotency

### 1. Migration: `supabase/migrations/<ts>_trip_notifications_idempotency.sql`

```sql
ALTER TABLE public.trip_notifications
  ADD COLUMN IF NOT EXISTS sent_date date NOT NULL DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_notifications_unique_per_day
  ON public.trip_notifications (trip_id, user_id, notification_type, sent_date);
```

### 2. Edge function: `supabase/functions/send-trip-reminders/index.ts`

Inside the `for (const trip of filteredTrips)` loop, **before** `sendReminderEmail()`:

- Build `notification_type = \`trip_reminder_${trip.reminderType}_d${trip.daysUntil}\`` so daily reminders on different `daysUntil` values still fire (only same-day cron retries are blocked).
- Build `sent_date = new Date().toISOString().slice(0, 10)`.
- `INSERT` into `trip_notifications` with `{trip_id, user_id, notification_type, sent_date, sent: false}`.
- If error code `'23505'` → `console.log` skip + `continue`. If other error → `console.error` + `continue` (don't email when claim fails).
- After successful `sendReminderEmail`, `UPDATE` the row set `sent: true, sent_at: now()` matched on the same 4-tuple.

### Verify
- `grep -n "trip_notifications.*insert\|sent_date\|23505" supabase/functions/send-trip-reminders/index.ts` → 3+ hits
- `ls supabase/migrations/ | grep trip_notifications_idempotency` → 1 hit

### Note on reminder-type granularity
Current `reminderType` ("daily"/"weekly"/"monthly") collapses 7 distinct `daysUntil` daily emails into one type. Using a daysUntil-suffixed type prevents idempotency from blocking the next-day reminder while still blocking same-day cron retries.