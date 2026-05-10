## Persist DNA Disambiguation Resolution to Database

LocalStorage-only resolution gets lost on browser clears, new devices, and incognito sessions. Persist to `travel_dna_profiles` so the answer follows the user.

### 1. Migration

New columns on `travel_dna_profiles`:
- `disambiguation_resolved_at TIMESTAMPTZ` (nullable, default NULL)
- `disambiguation_question_id TEXT` (nullable)
- `disambiguation_answer_id TEXT` (nullable)
- `COMMENT` on `disambiguation_resolved_at` documenting NULL semantics.

No RLS change needed — existing user-scoped policies on `travel_dna_profiles` already cover these columns. After migration the auto-generated `src/integrations/supabase/types.ts` will pick the new fields up.

### 2. `src/components/profile/MicroDisambiguation.tsx`

**a. Async resolution check on mount.** The current component reads `isResolved` synchronously from localStorage and early-returns at line 169. Refactor that into a `useEffect` that:
1. Seeds local state from `localStorage[dismissKey]` (instant render skip on returning Chrome session).
2. Queries `travel_dna_profiles.disambiguation_resolved_at` for `userId` (`.maybeSingle()`).
3. If non-null → `setIsResolved(true)` + write `localStorage[dismissKey] = 'true'` to sync the cache.
4. While the DB check is in flight, render `null` (no flicker — the prompt only ever appears after we know it's unresolved). Track a `checkedDb` boolean so we don't render the question UI until either localStorage was already true or the DB query has returned.

**b. Persist on resolution (around lines 218–227).** Right after the `recalculateDNAFromPreferences(userId)` call, before the localStorage write, add:

```ts
await supabase
  .from('travel_dna_profiles')
  .update({
    disambiguation_resolved_at: new Date().toISOString(),
    disambiguation_question_id: question.id,
    disambiguation_answer_id: selectedAnswer,
  })
  .eq('user_id', userId);
```

Keep the existing `localStorage.setItem(dismissKey, 'true')` as a fast-path cache. DB is canonical.

No other edits — `voyance_events` insert, override merge, and recalc all stay as-is.

### Verification

- Migration: `\d travel_dna_profiles` shows the three new columns.
- Resolve disambiguation in Chrome → `select disambiguation_resolved_at, disambiguation_question_id, disambiguation_answer_id from travel_dna_profiles where user_id = '<id>'` returns non-null.
- Open incognito as same user → component mounts, queries DB, sees the timestamp, returns null. No prompt shown.
- Clear localStorage in regular browser → same outcome (DB hit suppresses prompt).
