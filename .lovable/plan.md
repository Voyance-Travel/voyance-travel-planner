## Fix 1b — Defensive `quizCompleted` fallback in `transformProfile`

### Verified
- `AuthContext.tsx:69` reads `quizCompleted` solely from `profile?.quiz_completed`.
- `loadUserData` (lines 117–131) already fetches both `profile` and `preferences` in parallel and returns both — no extra query.
- `user_preferences.quiz_completed` is set by both `OnboardConversation` (line ~165 region) and `setPreferences` (line 632), so reading it as a fallback closes the sync-gap class regardless of which writer ran first.

### Change

In `src/contexts/AuthContext.tsx`, line 69 only:

```ts
quizCompleted: profile?.quiz_completed || preferences?.quiz_completed || false,
```

### Out of scope
- No signature change to `transformProfile` (it already accepts `preferences`).
- No new query, no schema change, no caller change.

### Validation
- A user whose `profiles.quiz_completed = false` but `user_preferences.quiz_completed = true` (the legacy/sync-gap state) now gets `user.quizCompleted = true` on next session and skips the onboarding gate.
- A fresh user with neither flag set still resolves to `false`.
