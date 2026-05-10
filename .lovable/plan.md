# Bump regenerate-day price 10 → 30

## Architecture note (important — what is and isn't a price)

The repo distinguishes between **headline price** (charged after the per-trip free quota is exhausted) and **free quotas** (how many regens/swaps/etc. are free per trip per tier). Greps for `regenerate_day` surface both:

- **Headline price** = the integer the user actually pays per regen. Stored in 4 places, all currently `10`.
- **Free quotas** (`TIER_CAPS`, `FLEX_CAPS_BY_DAYS`, `GROUP_UNLOCK_TIERS.caps`, `GROUP_CAPS`, `TIER_FREE_CAPS`) — values like `1/2/3/5` or `8/12/20`. These are **counts of free regens per trip**, NOT prices. **Do not touch.**

Server `spend-credits/index.ts` resolves cost via `cost = FIXED_COSTS[action]` (line 599), and the `REFUNDABLE_COSTS` block already keeps `REGENERATE_DAY: 0` to defer to the original ledger row — that stays `0` (intentional, per memory: defensive-refund pattern). No migration needed.

## Files to change (all 4 sites, identical bump 10 → 30)

### 1. `src/config/pricing.ts:19`
```ts
REGENERATE_DAY: 30,         // Regenerate a day (after free quota/trip) — half of generation rate
```

### 2. `supabase/functions/spend-credits/index.ts:22` (the server authority — billing source of truth)
```ts
regenerate_day: 30,
```

### 3. `src/services/itineraryChatAPI.ts:152, 157, 158`
The chat assistant displays `creditCost` on proposed actions. Bump three values:
- Line 152 (`regenerate_day` action's `creditCost`): `10 → 30`
- Line 157 (`rewrite_day` in `creditMap`): `10 → 30`
- Line 158 (`regenerate_day` in `creditMap`): `10 → 30`

(`rewrite_day` shares the `REGENERATE_DAY` server action — same price.)

### 4. `src/config/unitEconomics.ts:162`
Admin unit-economics dashboard reference. Cosmetic but must match for margin reporting:
```ts
regenerate_day: { credits: 30, costMin: 0.02, costMax: 0.08, desc: 'Regenerate a day' },
```

## UI text scan

No hardcoded "10 credits" string for regenerate-day exists. UI surfaces (`UpgradePrompt`, `OutOfCreditsModal`, `CreditNudge`, `OutOfFreeActionsModal`, `InlineModifier`) all read `CREDIT_COSTS.REGENERATE_DAY` or use the `creditCost` field from `itineraryChatAPI.ts`, so they'll auto-update once #1 and #3 land.

## Out of scope (and why)

- `TIER_CAPS` (1/2/3/5) — free **quotas per trip**, not prices.
- `FLEX_CAPS_BY_DAYS` / `TIER_FREE_CAPS` (1/2/3/4/5) — free **quotas**.
- `GROUP_UNLOCK_TIERS.caps.regenerate_day` (8/12/20) — group-share **quotas**.
- `GROUP_CAPS` (8/12/20) — same group quotas, edge mirror.
- `REFUNDABLE_COSTS.REGENERATE_DAY: 0` — intentional sentinel for defensive refund (reads original ledger row).

## Verification

1. Click "Regenerate day" on a trip past its free quota → confirmation/CreditNudge shows **30 credits**.
2. Approve → balance drops by 30; `credit_ledger` row has `amount = -30`, `action = 'regenerate_day'`.
3. From AI chat, accept a `rewrite_day` proposal → same 30-credit deduction.
4. Hard-fail the regen (force generation_failed) → existing refund path returns +30 (defensive lookup reads the new amount, not a stale 10).
