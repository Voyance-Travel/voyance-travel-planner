## Audit closeout — what's actually left

After the Q43 ship + your latest review, most items in the proposed "closeout batch" are already live. Probing the codebase + DB confirmed the real remaining work is small and focused.

### Already shipped (no action)

| Item | Evidence |
|---|---|
| Q43 rate limit (table-backed, 20/hr) | `_shared/db-rate-limiter.ts` reuses the existing `rate_limits` table — no new `friend_request_rate_log` table needed. Your "grep first" instruction is satisfied. |
| Byte-identical neutral ACK across all branches incl. rate-limit | `friend-request-by-email/index.ts` returns `json(200, ACK)` on rate-limit; test `ACK is the canonical neutral response shape` asserts the exact shape. |
| M3 wrap guard (`endTime===0 && startTime>0`) | Memory entry `health-gap-wrap-and-bookend-filter`. |
| M5 paid-tour ceiling bumps | Memory entry "M5 Paid-Tour Ceiling Bumps". |
| R5 parse-* curl spot-fix | Already shipped per prior batch. |

### Remaining work (this plan)

#### 1. R4 — profiles co-member RLS tightening (BLOCKING gate, real finding)

DB probe result:

```text
policy: "Users can view profiles of trip co-members"
expr:   id IN (SELECT tm.user_id FROM trip_members tm
               WHERE tm.trip_id IN (SELECT tm2.trip_id FROM trip_members tm2
                                    WHERE tm2.user_id = auth.uid())
                 AND tm.user_id IS NOT NULL)
```

`trip_members` has `accepted_at` (timestamp), not `status`. Current policy gates on **neither side** being accepted — a pending invitee can see profiles of other members, and existing members can see a pending invitee's profile. That matches the R4 invasive-pre-acceptance concern.

Fix: replace the policy with one that requires `accepted_at IS NOT NULL` on **both** the caller's membership and the target's membership:

```sql
DROP POLICY "Users can view profiles of trip co-members" ON public.profiles;

CREATE POLICY "Users can view profiles of trip co-members"
ON public.profiles FOR SELECT TO authenticated
USING (
  id IN (
    SELECT tm.user_id
    FROM public.trip_members tm
    WHERE tm.user_id IS NOT NULL
      AND tm.accepted_at IS NOT NULL
      AND tm.trip_id IN (
        SELECT tm2.trip_id
        FROM public.trip_members tm2
        WHERE tm2.user_id = auth.uid()
          AND tm2.accepted_at IS NOT NULL
      )
  )
);
```

No new column projection — this view is row-level only, the trip-collaborators column-projection concern (R4 prior finding) is already handled by `public_trip_collaborators` view per existing memory.

#### 2. Memory polish (non-code)

- **`mem://constraints/security/security-definer-accepted-class`** — append the exact verification SQL for the deferred `get_user_info_by_email` DROP, so future-you can paste-and-run when `pg_stat_statements` is enabled:
  ```sql
  SELECT calls, last_call, query
  FROM pg_stat_statements
  WHERE query ILIKE '%get_user_info_by_email%'
  ORDER BY last_call DESC NULLS LAST;
  ```
  Drop only if `calls = 0` (or only matches the now-removed in-repo callers).

- **New core-rule entry** `mem://constraints/itinerary/phantom-ref-rich-sentence-preservation` — document that when phantom-ref scrubbing finds substantive remaining content, the field is preserved (not blanked). This is correct behavior and the M1 test phrasing adjustment proved the guard is working. Prevents a future contributor from "fixing" the guard to be more aggressive.

#### 3. Test comment annotation (non-functional)

Add a short comment block to `phantom-ref-clause-scrub.test.ts` next to the M1 reviewer cases explaining why the phrasing was changed from the originally-proposed wording: "rich-sentence preservation guard intentionally preserves fields with substantive surrounding content; production leak only reproduces when the entire field collapses to empty after scrub." Future maintainer context, no behavior change.

### What this plan does NOT touch

- No new `friend_request_rate_log` table (existing infra reused).
- No edge function changes (rate-limit + ACK contract already correct).
- No changes to `_shared/db-rate-limiter.ts`.
- No `get_user_info_by_email` DROP (deferred until verification possible).

### Sequencing

1. R4 migration (single `DROP POLICY` + `CREATE POLICY`).
2. Memory file edits (2 files: append SQL to security-definer entry, create rich-sentence-preservation entry).
3. Test comment annotation.
4. Update `mem://index.md` Memories list with the new rich-sentence-preservation entry.

### Out of scope (per your status note)

Final Supabase linter run, fresh-city Madrid-style QA, Stripe E2E, beta-2 invite, launch.

---

After this lands, the audit cycle is genuinely done from a code/RLS standpoint and we're in pure verification + launch-ops territory.
