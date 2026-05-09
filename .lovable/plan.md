## Fix 1 — Sync `quiz_completed` to `profiles` from `setPreferences`

### Verified
- `AuthContext.tsx:623-666` — `setPreferences` writes only to `user_preferences`. No `profiles` upsert.
- `OnboardConversation.tsx:179-192` — Already does the matching `profiles` upsert (`id`, `quiz_completed: true`, `updated_at`) with `onConflict: 'id'`. We're mirroring this exact pattern.
- `transformProfile` reads `quiz_completed` from `profiles`, so any flow that calls `setPreferences` without going through `OnboardConversation` (e.g. quick-quiz, programmatic preference save, future entry points) leaves `profiles.quiz_completed = false` and the user is re-prompted next session.

### Change

In `src/contexts/AuthContext.tsx`, after the existing `user_preferences` upsert succeeds (line 656) and before the local `setUser` (line 661), add a best-effort `profiles` upsert:

```ts
// ALSO mark profiles.quiz_completed so transformProfile picks it up next session.
// Best-effort: preferences already saved; don't throw on failure.
const { error: profileError } = await supabase.from('profiles').upsert(
  { id: session.user.id, quiz_completed: true, updated_at: new Date().toISOString() },
  { onConflict: 'id' }
);
if (profileError) {
  console.error('[Auth] Error syncing profile.quiz_completed:', profileError);
}
```

### Out of scope
- No change to the `user_preferences` upsert above it.
- No change to `OnboardConversation.tsx` (already correct).
- No throw on profile error — preferences save is the source of truth; `quiz_completed` mirroring is a derived flag.

### Note on remaining fixes
The user message references "Fix 1b" plus 3 medium / 2 low fixes from the audit but only Fix 1 was included in this turn. I'll ship Fix 1 now; the remaining fixes can land as separate follow-up turns when their specs arrive.

### Validation
- Call `setPreferences(...)` from a non-onboarding code path (e.g. devtools or an existing settings save) → check `select quiz_completed from profiles where id = '<uid>'` returns `true`.
- Reload session → `transformProfile` flips `quizCompleted` to `true` without re-running onboarding.
- Force the profiles upsert to fail (e.g. revoke RLS in a scratch env) → preferences still save, console logs the sync error, no exception bubbles to the caller.
