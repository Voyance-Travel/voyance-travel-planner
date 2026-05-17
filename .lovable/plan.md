## Problem

Clicking **Refine My Profile** on `/profile` surfaces "Something went wrong. Please try again." The handler in `src/components/profile/MicroDisambiguation.tsx#handleSubmit` runs a chain of 4 Supabase calls + a DNA recalc, but only logs the final caught error — none of the intermediate Supabase responses are checked for `.error`, so the actual failing step is invisible (the user's screenshot has no surfaced detail, and the production site means we can't pull preview console logs).

Most likely culprits (all currently silent):
1. `voyance_events` insert — RLS gate `auth.uid() = user_id` rejects if the session is stale.
2. `profiles.update({ travel_dna_overrides })` — same RLS pattern; 0-row updates also slip past.
3. `recalculateDNAFromPreferences` → `calculate-travel-dna` edge fn — returns `{success:false}` without throwing, so we already "succeed" silently when DNA recalc fails.
4. `travel_dna_profiles.update({ disambiguation_resolved_at })` — updates 0 rows if the user has no DNA row yet (then the banner re-appears next visit even on "success").

## Fix

Rewrite `handleSubmit` so each step is checked and labeled, and so we cannot localStorage-dismiss the banner unless the underlying writes actually succeed.

1. **Guard session early** — `supabase.auth.getSession()`; if no `access_token`, `toast.error("Please sign in again")` and abort.
2. **Sequence with explicit error capture**:
   - `voyance_events.insert(...)` — capture `error`, log `[Disambig] event_insert`, continue regardless (analytics is non-blocking).
   - `profiles.select('travel_dna_overrides').eq('id', userId)` — capture; on error abort with `toast.error("Couldn't load your profile")`.
   - `profiles.update({ travel_dna_overrides: merged }).eq('id', userId).select('id')` — `.select()` makes the row count visible; if `data.length === 0` or `error`, abort with labeled toast.
   - `recalculateDNAFromPreferences(userId)` — already returns `{success}`; on `success === false`, surface "Refinement saved but DNA recalc failed - try again" toast and DO NOT mark resolved.
   - `travel_dna_profiles.upsert({ user_id, disambiguation_resolved_at, disambiguation_question_id, disambiguation_answer_id }, { onConflict: 'user_id' })` — use upsert so first-time users without a DNA row still get marked resolved.
3. **Only set `isResolved=true` + `localStorage` flag after all required steps return OK** (events insert is best-effort).
4. **Add `console.error('[Disambig] step=<name>', error)`** at every failure site so future occurrences can be diagnosed from preview logs.
5. **Map error to a useful toast** instead of the generic copy: include the failing step name in the toast so QA can report it.

## Files

- `src/components/profile/MicroDisambiguation.tsx` — rewrite `handleSubmit` per above. ~40 lines changed.

## Out of scope

- No backend / edge function / RLS changes. If after the rewrite the labeled toast points at a specific RLS or edge-function failure, we'll address it in a follow-up with concrete evidence.
- No new memory entry yet; will add one if the labeled telemetry reveals a recurring root cause.
