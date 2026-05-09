## Fix 2.1 — Quiz flag sync

### Status: Already shipped in code

Verified in `src/contexts/AuthContext.tsx`:

- **Line 69** — `transformProfile` already does the defensive double-read:
  ```ts
  quizCompleted: profile?.quiz_completed || preferences?.quiz_completed || false,
  ```
- **Lines 670–676** — `setPreferences` already mirrors `quiz_completed` onto `profiles` after the `user_preferences` upsert, with best-effort error handling (logs, doesn't throw).

Both `grep` checks from the spec pass. No code changes needed.

### Backfill: not needed

Ran the diagnostic against the live DB:
```sql
SELECT COUNT(*) FROM profiles p
JOIN user_preferences up ON up.user_id = p.id
WHERE up.quiz_completed = true AND p.quiz_completed IS NOT TRUE;
-- → 0
```
Zero users are currently stuck, so the backfill `UPDATE` is a no-op. Skipping the migration to avoid unnecessary churn.

### Action

Close Fix 2.1 as already-implemented and move to the next ticket. No files modified, no migration run.