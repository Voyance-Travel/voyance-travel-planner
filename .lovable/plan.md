## RS.L3 — Account-deletion cascade audit

### Findings

`USER_DATA_TABLES` in `delete-my-account/index.ts` already covers ~48 tables incl. `trip_collaborators` and `trip_notifications`. DB inventory revealed **~36 tables with a user-owning column missing from the list**.

Three categories:

**A. Add to cascade (delete user's rows):**
`iap_transactions`, `community_guides`, `guides`, `guide_favorites`, `guide_content_links`, `guide_activity_reviews`, `guide_manual_entries`, `saved_guides`, `travel_guides`, `trip_blogs`, `trip_chat_messages`, `trip_day_intents`, `trip_memories`, `trip_ratings`, `trip_reviews`, `trip_suggestions`, `trip_suggestion_votes`, `trip_action_usage`, `suggestion_votes`, `user_badges`, `user_social_links`, `user_tiers`, `referral_codes`, `push_tokens`, `pending_credit_charges`, `credit_purchases`, `founding_member_tracker`, `free_tier_status`, `chat_idempotency_cache`, `invite_failure_log`, `group_budget_transactions`.

**B. Special columns (not `user_id`):**
- `friendships` → `requester_id` and `addressee_id` (delete on either).
- `group_budgets` → `owner_id`.
- `guide_reports` → `reporter_id`.

**C. Intentionally retained (audit/observability — keep raw, NULL out user_id later if needed):**
`audit_logs`, `client_errors`, `page_events`, `voyance_events` (already in list — re-evaluate but keep for v1).

### Plan

Single-file edit to `supabase/functions/delete-my-account/index.ts`:

**1. Extend `USER_DATA_TABLES`** with the 31 category-A tables. Order: child→parent (guides children before `guides`, trip_* children before `trips` already present). Insert into existing groupings.

**2. Add a small `SPECIAL_COLUMN_TABLES` array** for the 3 non-`user_id` cases:
```ts
const SPECIAL_COLUMN_TABLES: Array<{ table: string; columns: string[] }> = [
  { table: 'friendships', columns: ['requester_id', 'addressee_id'] },
  { table: 'group_budgets', columns: ['owner_id'] },
  { table: 'guide_reports', columns: ['reporter_id'] },
];
```

**3. After the existing `for (table of USER_DATA_TABLES)` loop**, add:
```ts
for (const { table, columns } of SPECIAL_COLUMN_TABLES) {
  for (const col of columns) {
    try {
      const { error } = await supabase.from(table).delete().eq(col, userId);
      if (error) console.warn(`[delete-my-account] Warning deleting from ${table}.${col}: ${error.message}`);
    } catch (err) {
      console.warn(`[delete-my-account] Could not delete from ${table}.${col}: ${err}`);
    }
  }
}
```

The existing per-table `try/catch` already swallows errors from columns that don't exist, so a stale entry won't break deletion.

### Out of scope
- Converting any of these to DB-level `ON DELETE CASCADE` (would require migrations + auth.users FK audit; v1.x compliance pass).
- Anonymizing audit/observability tables (`audit_logs`, `client_errors`, `page_events`) — intentional retention for ops/legal.
- Storage objects owned by user (avatars, photos) — separate ticket.

### Verification
- `grep -c "trip_collaborators\|friendships\|trip_notifications" supabase/functions/delete-my-account/index.ts` ≥ 3 (expected 3+ after change).
- `iap_transactions` and `friendships` both appear in the file.