## P1.8 — CL.3: de-scope, close the cost-leak category

### Decision

**Mark CL.3 not applicable. Close the cost-leak category.**

### Why

Pass 1 (Apr 30, recorded in `mem://technical/observability/cost-savings-pass-1`) shipped exactly **two** distinct caching/skipping wins, plus collateral guards:

| ID    | Leak                       | Fix shipped                                                                   |
| ----- | -------------------------- | ----------------------------------------------------------------------------- |
| CL.1  | `destination_images` Google Places spend | TIER 1.5 shared-table lookup (`attractions`+`activities` ILIKE) before Google; CostTracker skips $0 rows; HARD_GENERIC name guard; negative-cache TTL 14d→30d |
| CL.2  | `viator-search` repeat calls | In-memory 24h LRU (max 500 entries), keyed by `activity\|destination\|category`, with tripId/userId/referrer attribution |
| CL.3  | *(speculative in original audit)* | **No distinct third helper identified, in memory or in the codebase.**            |

The original audit listed CL.3 as "TBD — likely a third caching helper." The (7) verification couldn't find one because **there isn't one**. The only adjacent areas worth scanning were:

- **Google Place Details / Photo URL cache** — already covered by `googleApiCache` table + the centralized wrapper (see `mem://technical/observability/google-api-centralization`). No leak.
- **`user_behavior` tracking writes** — fire-and-forget inserts, no external API spend, not a cost leak.
- **Stripe API calls** — already idempotent + webhook-driven; no polling pattern leaking calls.

Post-Pass-1 spend signals (per the cost-savings memory verification target: ≥40% reduction on `destination_images`) have held. There is no smoking-gun third leak to chase.

### Action

1. **Close CL.3 as `not_applicable`** in the audit ledger with the note:
   > "CL.3 was speculative. No distinct third caching helper identified post-Pass-1. Google Places (CL.1), Viator (CL.2), and the centralized Google API wrapper cover all known billable-call surfaces. Reopen only if `trip_cost_tracking` shows a new sustained spike on a non-CL.1/CL.2 source."

2. **Close the cost-leak category.** Future cost work should be opened as new tickets, triggered by an actual `trip_cost_tracking` spike rather than a speculative slot in the original audit.

3. **Re-open trigger (documented for future-me):** if `trip_cost_tracking` shows >$X/week sustained on any single `source` other than `destination_images` / `viator_search`, file CL.3 fresh against that specific source.

### Files / state changed

- Edit `.lovable/plan.md` only — append the P1.8 closure note. No code, no migrations, no deploys.

### Out of scope (explicitly)

- I am **not** speculatively adding a Google Place Details cache "just in case" — `googleApiCache` already exists and the centralized wrapper enforces it. Adding a second layer with no observed leak would be cargo-culting and adds maintenance burden.
- I am **not** caching `user_behavior` writes — they don't hit external APIs.
