## M2 — Activity feedback mirrors to trip_activities

Mirror `activity_feedback` rows onto `trip_activities` so the UI can show "you rated this" without a join. Ledger row stays source of truth.

### Type mismatch caught during exploration

The proposed snippet writes `user_rating: data.rating`, but `rating` in this codebase is a **text enum** (`'loved' | 'liked' | 'neutral' | 'disliked'`), not numeric. The suggested `SMALLINT` column would reject every write. The plan stores `user_rating` as **TEXT** instead — no mapping layer needed, matches `activity_feedback.rating`.

### Step 1 — Migration

`trip_activities` currently has no `user_rating` / `user_feedback_at` columns (verified via information_schema). Add them:

```sql
ALTER TABLE public.trip_activities
  ADD COLUMN IF NOT EXISTS user_rating TEXT,
  ADD COLUMN IF NOT EXISTS user_feedback_at TIMESTAMPTZ;
```

No RLS changes — existing trip_activities policies cover the new columns.

### Step 2 — Edit `src/services/activityFeedbackAPI.ts`

In `submitActivityFeedback`, after the existing successful upsert (after line 106's `analyzeUserPreferences()` call, before `return`), add:

```ts
// Mirror feedback presence onto the trip activity record so the UI can show
// "you rated this" without joining tables. Fire-and-forget; ledger insert is
// the source of truth.
if (data?.activity_id && data?.rating != null) {
  void supabase
    .from('trip_activities')
    .update({
      user_rating: data.rating,
      user_feedback_at: new Date().toISOString(),
    })
    .eq('id', data.activity_id)
    .then(({ error }) => {
      if (error) console.warn('[activityFeedback] mirror to trip_activities failed:', error);
    });
}
```

Fire-and-forget (`void`) — never block the feedback submission on the mirror.

### Verify

- `grep -n "mirror to trip_activities" src/services/activityFeedbackAPI.ts` → 1 hit
- After submitting feedback in the UI, `select user_rating, user_feedback_at from trip_activities where id = '<activity_id>'` returns the rating + recent timestamp
- Mirror failure logs `[activityFeedback] mirror to trip_activities failed` as a warn, not an error throw
