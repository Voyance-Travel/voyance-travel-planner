## Goal
Block credit farming on `grant-bonus-credits` by verifying server-side that each bonus's qualifying action actually happened before granting credits.

## Change scope
Only `supabase/functions/grant-bonus-credits/index.ts`. No DB schema changes — all required tables already exist (`quiz_sessions`, `user_preferences`, `referral_codes`/`referrals`, `trips`, `auth.users`).

## Verification rules (added before the "already claimed" check)

After resolving `bonusType` and loading the service-role client, gate each type:

| bonusType | Check (service role) | Fail response |
|---|---|---|
| `welcome` | `user.email_confirmed_at IS NOT NULL` (from `auth.admin.getUserById`) | 403 `EMAIL_NOT_VERIFIED` |
| `launch` | same email-verified check + existing launch-window check | 403 `EMAIL_NOT_VERIFIED` / existing launch-window response |
| `quiz_completion` | `quiz_sessions` has row where `user_id=$` AND (`is_complete=true` OR `completed_at IS NOT NULL` OR `status='completed'`) | 403 `ACTION_NOT_COMPLETED` |
| `preferences_completion` | `user_preferences` row exists with `quiz_completed=true` OR (`travel_pace IS NOT NULL` AND `budget_tier IS NOT NULL` AND `interests` length > 0) | 403 `ACTION_NOT_COMPLETED` |
| `first_share` | a referral/share artifact exists for this user — pick the live table at implementation time (`referral_codes`, `referrals`, or `trip_shares` — verify which exists with `\d`); require ≥1 row owned by user | 403 `ACTION_NOT_COMPLETED` |
| `second_itinerary` | `select count(*) from trips where user_id=$ and itinerary_status in ('completed','generated','ready')` ≥ 2 | 403 `ACTION_NOT_COMPLETED` |

All failure responses share shape: `{ granted:false, reason:'<code>', bonusType }` with HTTP 403 (not 200, so client `useBonusCredits` mutation surfaces an error path) and a single-line `console.warn` with `user.id` + `bonusType` for abuse telemetry.

## Implementation notes
- Add a `verifyBonusEligibility(userId, bonusType, supabaseAdmin, authClient)` helper at module scope returning `{ ok: true } | { ok: false, code: string }`.
- Call it immediately after the existing `BONUS_CONFIG` lookup, **before** the launch-window and "already claimed" checks (cheap fail-fast).
- For `first_share`: confirm exact table name with one `code--exec psql \d` lookup at implementation time so the rule isn't broken.
- For `welcome`/`launch` email-verified check: use `supabaseAdmin.auth.admin.getUserById(user.id)` rather than re-trusting the JWT claim.
- Idempotency unchanged: existing `user_credit_bonuses` unique-per-(user,type) check still runs after verification, so re-claims still return `granted:false`.
- No client-side changes in `useBonusCredits`/`WelcomeBonusManager` — they already swallow non-granted responses gracefully via React Query.

## Out of scope
- Trigger-based auto-grants (mentioned in the finding as an alternative) — bigger refactor, not needed to close the vuln.
- Backfill / clawback of credits already farmed — call out in chat after shipping; user can decide.

## Verify
- After edit: `curl` the function with each `bonusType` from a fresh test user (no quiz, no prefs, no shares, no trips) — all five non-welcome types must return 403 `ACTION_NOT_COMPLETED`. `welcome` from an unverified-email user must return 403 `EMAIL_NOT_VERIFIED`. Then complete the action and confirm the bonus grants on the next call.
- Mark finding `bonus_credit_unverified` fixed via `security--manage_security_finding` with explanation.
