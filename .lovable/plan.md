## TL;DR

The UNIQUE constraint the request asks for **already exists**. No migration is required for defense-in-depth.

## Evidence

`supabase/functions/send-trip-reminders/index.ts:493-512` performs an idempotency claim by inserting into `trip_notifications` and treating Postgres error code `23505` as "already sent today, skip".

Live `pg_indexes` for `public.trip_notifications`:

```text
idx_trip_notifications_unique_per_day
  UNIQUE btree (trip_id, user_id, notification_type, sent_date)   ← THIS is the dedupe gate
unique_trip_notification
  UNIQUE btree (trip_id, notification_type)                       ← legacy / redundant
trip_notifications_pkey                                            ← primary key
idx_trip_notifications_trip_id                                     ← lookup
idx_trip_notifications_type_sent                                   ← lookup
```

`notification_type` is built as `trip_reminder_${reminderType}_d${daysUntil}` (line 490) and `sent_date` is today's UTC date (line 491). Together with `trip_id` and `user_id`, the four-column UNIQUE index on `idx_trip_notifications_unique_per_day` is exactly the constraint the request specifies. A duplicate cron invocation, manual re-trigger, or retry on the same UTC day raises `23505`, the function logs `Already sent … skipping`, and no second email is sent.

## Recommendation

**No new migration.** Defense-in-depth is already enforced at the database layer.

Optional cleanup (separate, low-priority): drop the legacy `unique_trip_notification (trip_id, notification_type)` index. It is strictly weaker than the per-day index and could in theory block a legitimate same-`notification_type` re-insertion years apart (not currently possible because `notification_type` embeds `daysUntil`, but a future contributor changing the type format could be silently surprised). I recommend leaving this for a future cleanup pass, not bundling it here, because removing it carries non-zero risk and the user's stated goal — "code already enforces dedupe; this is defense-in-depth" — is already met.

## What I checked

1. **Function dedupe semantics** — `send-trip-reminders/index.ts` claim-then-send pattern with `23505` short-circuit.
2. **Index coverage** — direct `pg_indexes` query confirmed the 4-column UNIQUE matches the requested shape.
3. **Type-prefix uniqueness** — `notification_type` includes both `reminderType` (daily/weekly/monthly) and `daysUntil`, so the same trip+user can still receive a different reminder later in the trip lifecycle.

## Out of scope

- No code changes to `send-trip-reminders/index.ts`.
- No reorganisation of `trip_notifications` columns.
- No removal of `unique_trip_notification` (deferred — see Recommendation).