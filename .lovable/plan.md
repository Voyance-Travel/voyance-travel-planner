## Deploy all edge functions and apply 2 migrations

Code is synced from GitHub (main). No code changes — pure deploy + migrations.

### Step 1 — Deploy all edge functions

Ship every function in `supabase/functions/` (~115 functions) via `supabase--deploy_edge_functions`. This includes the PRs you listed:
- generate-itinerary (PR #40 — saveReason rename)
- _shared/google-api.ts → consumed by all callers (PR #41 — Google daily ceiling)
- venue-enrichment + destination-images (PR #42 — shared place-level cache)
- spend-credits + stripe-webhook (PR #34 — credit accuracy)
- calculate-travel-dna (already deployed earlier — will re-ship)

### Step 2 — Apply 2 migrations

1. `20260605130000_friend_outgoing_pending_visibility.sql` (C-FRIEND-1 RLS)
2. `20260605140000_google_api_daily_budget.sql` (Google budget table)

Both files confirmed present in `supabase/migrations/`. I'll surface them via the migration tool for your approval.

### Order

Functions first, then migrations (migrations need your yes/no before they run).

### What I won't touch

No source files, no `config.toml`, no logic changes. Pure ship.

Approve to proceed.