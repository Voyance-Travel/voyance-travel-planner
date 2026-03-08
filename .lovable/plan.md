

## Fix: Activity Feedback 400 Errors — UUID Column Type Mismatch

### Problem
`activity_feedback.activity_id` is typed as `uuid` with a foreign key to `trip_activities`. Frontend sends string slugs like `"franklin-01"` → 400 errors. Failed save triggers `analyzeUserPreferences()` which calls `getUser()` during error state, potentially causing session issues.

### Fix 1: Database Migration
Drop the FK constraint and change `activity_id` from `uuid` to `text`:
```sql
ALTER TABLE public.activity_feedback DROP CONSTRAINT IF EXISTS activity_feedback_activity_id_fkey;
ALTER TABLE public.activity_feedback ALTER COLUMN activity_id TYPE text USING activity_id::text;
```
The unique constraint `activity_feedback_user_id_activity_id_key` will survive the type change automatically.

### Fix 2: Guard `analyzeUserPreferences()` call
In `src/services/activityFeedbackAPI.ts` line 104, wrap the call so it only fires when data is returned (save succeeded):
```ts
if (data) {
  analyzeUserPreferences().catch(console.error);
}
```

### No other changes needed
- `ActivityMediaCapture.tsx` upsert will work once the column is `text` — `personalization_tags` column already exists.
- `InlineActivityRating` and `ActivityFeedbackModal` both call `submitFeedback` which goes through the same upsert path — all fixed by the migration.

