# L5 — Move scheduled notifications to a relational table (DEFERRED)

**Status:** Deferred. Documented for the future; not to be implemented in this turn. Current JSONB approach is fine while trip volume is small. Trigger a migration when *any* of: trips table > ~5k rows with notifications, p95 `trips` row size approaches the 8KB toast threshold, or the cron sweep in `trip-notifications` exceeds ~2s.

## Current shape (for reference)

`supabase/functions/trip-notifications/index.ts` reads/writes `trips.metadata.scheduledNotifications: TripNotification[]` at five call sites:

- L195–199 — overwrite on schedule
- L222–237 — cron sweep selects every active trip's full `metadata`
- L261–283 — single-trip update on dismiss
- L410–461 — list-for-user fetch

Every write rewrites the entire `metadata` blob; the cron sweep deserializes JSONB for every active trip even when none are due.

## Target schema

```sql
create table public.trip_notifications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null,
  type text not null,                 -- 'pre_trip' | 'mid_trip' | 'post_trip' | 'feedback' | …
  title text not null,
  message text not null,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  dismissed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index trip_notifications_due_idx
  on public.trip_notifications (scheduled_for)
  where delivered_at is null and dismissed_at is null;

create index trip_notifications_trip_idx on public.trip_notifications (trip_id);
create index trip_notifications_user_idx on public.trip_notifications (user_id);

alter table public.trip_notifications enable row level security;

create policy "owner reads own notifications"
  on public.trip_notifications for select
  using (auth.uid() = user_id);

create policy "owner dismisses own notifications"
  on public.trip_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inserts/scheduling done via service role from the edge function only.
```

## Migration path (zero-downtime, three deploys)

1. **Deploy 1 — dual-write, single-read.** Add the table + RLS. In `trip-notifications/index.ts` keep reading from `metadata.scheduledNotifications` but additionally `upsert` into `trip_notifications` on every schedule/dismiss. No reader change yet.
2. **Backfill.** One-shot job: for each trip with `metadata.scheduledNotifications`, insert any rows missing in `trip_notifications` (dedupe on `trip_id + type + scheduled_for`).
3. **Deploy 2 — flip reads.** Cron sweep + user-list fetch query `trip_notifications` directly (`scheduled_for <= now() and delivered_at is null and dismissed_at is null`). Stop reading the JSONB blob. Keep dual-write briefly as a safety net.
4. **Deploy 3 — drop JSONB.** Remove `metadata.scheduledNotifications` writes and run a migration to strip the key from existing rows: `update trips set metadata = metadata - 'scheduledNotifications'`. Update any frontend that still reads it.

## Frontend impact

Search hits for `scheduledNotifications` outside the edge function: zero. Frontend only consumes the function's response shape, which stays the same. No UI change required.

## Out of scope

- Push/email channel changes.
- Cron job schedule.
- Any work in this turn — this plan exists so we have it ready when the trigger conditions hit.

## When to revisit

Open this plan and execute Deploy 1 the moment a) `select count(*) from trips where jsonb_array_length(coalesce(metadata->'scheduledNotifications','[]'::jsonb)) > 0` exceeds ~5k, b) `pg_column_size(metadata)` p95 > 4KB on `trips`, or c) the `trip-notifications` cron run exceeds 2s.
