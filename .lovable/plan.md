# Plan: Delete 9 verified-orphan edge functions

## Verification done

For each of the 9 candidates I ran `rg -l "<name>" src supabase --type ts --type tsx --type sql` excluding the function's own folder. **All returned zero hits.** I also queried `cron.job` directly: only `send-trip-reminders`, `cleanup_rate_limits`, and `sync_expired_credit_balances` are scheduled — none of the 9 candidates appear.

## Functions to delete

| Function | Lines | Status |
|---|---:|---|
| `discover-hidden-gems` | 391 | 0 refs, not cron |
| `score-image-quality` | 231 | 0 refs, not cron |
| `post-trip-cron` | 120 | 0 refs, **not actually scheduled** despite the name |
| `seed-demo-user` | 650 | 0 refs, not cron |
| `purchase-smart-finish` | 96 | 0 refs, not cron |
| `spend-group-credits` | 160 | 0 refs, not cron |
| `generate-travel-blog` | 275 | 0 refs, not cron |
| `generation-canary` | 173 | 0 refs (dev tool), not cron |
| `enrich-preferences` | 341 | 0 refs, not cron |

Total: ~2,437 lines of dead edge-function code.

## Steps

1. Delete the 9 directories under `supabase/functions/` via `rm -rf`.
2. Call `supabase--delete_edge_functions` with the 9 names so the deployed copies are also removed (per its tool docs).
3. Skip `supabase/config.toml` — these functions don't have function-specific config blocks (default `verify_jwt`).

## Out of scope (explicitly per the brief)

- The "likely orphaned but UNVERIFIED" list (`golden-persona-tests`, `backfill-*`, `cleanup-*`, `migrate-site-images`, `aggregate-personalization-stats`, `test-email`).
- Webhook endpoints (`auth-email-hook`, `stripe-webhook`, `validate-iap-receipt`) — externally triggered, never appear in internal grep.
- The earlier false-positives (`budget-coach`, `moderate-guide-content`, `enrich-destinations`) — confirmed in use.

## Risk

Low. Each function verified independently. If anything was missed (e.g. an external system invoking one of these directly via URL), the function can be re-added from git history.
