## Fix 3.2 — post-trip-email opt-out preference check

Insert a preference gate in `supabase/functions/post-trip-email/index.ts` after line 67 (ownership check) and before line 69 (already-sent check).

### Verified
- `user_preferences` has both `email_notifications` and `trip_reminders` columns.
- `trip_notifications` has `UNIQUE (trip_id, notification_type)` (`unique_trip_notification`) — `upsert` with `onConflict: 'trip_id,notification_type'` works.

### Change
Query `user_preferences` for the user; if either flag is explicitly `false`, log + upsert a `trip_notifications` row with `sent=true` and `metadata.skipped_reason='user_opted_out'`, then return `{ success: true, skipped: true, reason: 'user_opted_out' }`. Missing prefs row = defaults true → proceed normally. `forceResend` path unaffected.

No DB migration, no other file changes.

### Verification
```
grep -n "user_preferences\|email_notifications\|trip_reminders" supabase/functions/post-trip-email/index.ts   # 3+ hits
grep -n "user_opted_out\|skipped_reason" supabase/functions/post-trip-email/index.ts                          # 2+ hits
```
