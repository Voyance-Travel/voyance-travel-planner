# Ship Queue: Walking-Tour + Description Coverage + Q43 Drop + M1/M2 Tests

All five items approved. Per memory + repo audit, walking-tour bimodal split and description-coverage 3-layer defense are **already shipped** (mem://constraints/itinerary/per-category-price-sanity + mem://constraints/itinerary/description-coverage). This batch executes the **net-new** work: Q43 watch-list drop + M1/M2 regression tests.

---

## Critical diagnostic flag — Q43 plan needs revision

The reviewer's plan says "**Confirmed zero callers in the codebase**" for `get_user_id_by_email` and `get_user_info_by_email`. **That is incorrect.** Repo grep found:

```
src/services/supabase/friends.ts:162  // sendFriendRequestByEmail()
src/pages/admin/SessionExplorer.tsx:60  // admin tool
```

`get_user_id_by_email` is currently **admin-only** (per `has_role('admin')` check shipped in prior round). That means **`sendFriendRequestByEmail` has been silently broken for non-admin users since the hardening shipped** — it throws "Forbidden: admin role required" on every "Add friend by email" attempt.

Dropping the RPC outright would not "eliminate dead code" — it would make the breakage explicit (404 instead of 403). The right fix is the architectural pattern the reviewer cited later in the message:

> "Build the new feature on the principle 'never return whether an email is registered' — always send the email regardless, route to magic-link (existing user) or signup-invite (new user) based on lookup happening server-side in the email sender."

### Q43 — revised path

1. **pre-flight `pg_stat_statements` check** (reviewer note):
   ```sql
   SELECT calls, query
   FROM pg_stat_statements
   WHERE query ILIKE '%get_user_id_by_email%'
      OR query ILIKE '%get_user_info_by_email%'
   ORDER BY last_call DESC NULLS LAST
   LIMIT 20;
   ```
   If any non-repo callers surface, document them before changing function shape.

2. **New edge function `friend-request-by-email`** (service-role lookup, enumeration-safe):
   - Looks up target user_id via service-role query on `auth.users`
   - If found AND not self AND no existing friendship: insert friend request as the caller
   - If not found OR self OR already-friends: return identical generic success shape
   - Always returns the same response shape — never reveals registration status
   - Caller is `auth.uid()`; no admin role required

3. **Refactor `friends.ts::sendFriendRequestByEmail`** to invoke the new edge function instead of the RPC. UI surfaces a single neutral toast ("If that email belongs to a Voyance user, your request has been sent.").

4. **Restrict `get_user_id_by_email` to admin-only** (already done per memory) and keep `SessionExplorer.tsx` as the only caller. Confirms the "admin tool needs n" comment from migration `20260511115400`.

5. **Drop `get_user_info_by_email`** (after `pg_stat_statements` check confirms zero non-repo callers — there are zero repo callers for the `_info_` variant). Single migration.

6. **Memory update**: revise mem://constraints/security/security-definer-accepted-class to reflect the refactor (friend-by-email no longer runs through SECURITY DEFINER admin RPC).

---

## M1 phantom-ref regression test (round 2)

Per memory `mem://constraints/itinerary/schedule-coherent-copy`, the scrubber + DESCRIPTION_GHOST_REFERENCE validation code is shipped, and `phantom-ref-clause-scrub.test.ts` already covers the dinner-present/dinner-absent shapes. Add the **two reviewer-spec test cases verbatim** as the canonical regression sentinel inside that file:
- "drops 'Tonight's dinner has limited seating' when no dinner card on Day 2"
- "preserves the same sentence when the day has a dinner card"

These mirror the production Madrid leak shape (single-sentence description, prior assertions covered partial-clause/em-dash patterns).

---

## M2 combined departure-day regression test

Single new test in `supabase/functions/_shared/__tests__/departure-day-combined.test.ts`. Constructs a Day N final-day shape with all three known failures co-occurring:
- Late checkout at 14:00
- Untimed airport transfer (no startTime)
- Post-transfer dinner at 19:30

Asserts after one `enforceDepartureDayLogistics` pass:
- Checkout retimed ≤ 11:00 (cap = `min(11:00, dep − buffer − transfer − 60 − 30)`)
- Transfer ends at `dep − buffer`
- Post-transfer dinner pruned (non-locked)

**Reviewer addendum — activity order assertion:**
```ts
const ids = out.activities.map(a => a.id);
const lunchIdx    = ids.indexOf('lunch');
const checkoutIdx = ids.indexOf('checkout');
const transferIdx = ids.indexOf('transfer');
expect(lunchIdx).toBeLessThan(checkoutIdx);
expect(checkoutIdx).toBeLessThan(transferIdx);
```

Plus the second test from the original plan: locked-dinner preservation — same shape but the post-transfer dinner row carries `metadata.userLocked = true`. After repair, the locked dinner survives even though it violates departure-day logistics (universal locking wins). Add the same order assertion (lunch < checkout < transfer); the locked dinner ends up wherever the locking protocol places it (typically end-of-array; assert it's still present, not its index).

---

## Description-coverage telemetry note

Per reviewer's "Defer this nuance unless telemetry shows a problem" — **no code change this round**. Document the telemetry watch in memory:

> If `RESTAURANT_MISSING_RECOMMENDATION` fires >5% of restaurant rows in production over a 7-day window, relax the rule to fire only when `description.length < 60 chars AND lacks an imperative verb`. Don't pre-tighten.

Add to `mem://constraints/itinerary/description-coverage` as the documented escape valve.

---

## Walking-tour split — verification only

Per memory `mem://constraints/itinerary/per-category-price-sanity`, bimodal split is shipped:
- `walking_tour_paid` (min $15, regex paid|guided|premium|private|food|tapas|wine|history|ghost|architecture)
- Generic `walking_tour` (min $0)
- Prefix-wins ordering verified

Confirm via existing test file `m5-paid-tour-floor.test.ts`. No new code.

---

## Execution order

1. `pg_stat_statements` query — surface any non-repo callers
2. New edge function `friend-request-by-email` (service-role + enumeration-safe response shape)
3. Refactor `src/services/supabase/friends.ts::sendFriendRequestByEmail` to invoke it; update toast copy
4. Migration: `DROP FUNCTION public.get_user_info_by_email(text)` (zero callers, period)
5. M1 regression test (append two cases to `phantom-ref-clause-scrub.test.ts`)
6. M2 combined test (new file, two tests, with order assertion)
7. Run vitest + Deno test suites
8. Memory updates: `security-definer-accepted-class` (friend-flow refactored), `description-coverage` (telemetry watch)

---

## Out of scope

Fresh-city Madrid-style QA, Stripe E2E manual config, beta-2 invite, final linter rerun — all in the post-batch verification phase.

## Decision required

The Q43 path above (refactor `friends.ts` to a service-role edge function + drop only the `_info_` variant) is the architecturally correct read of "never return whether an email is registered." If you'd rather the simpler (but feature-removing) path — drop both functions and remove `sendFriendRequestByEmail` UI entirely until the new flow is built — flag and I'll switch the plan.
