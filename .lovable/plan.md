
# Full Pricing Spec Implementation — Gap Analysis and Plan

## Current State vs Spec — What's Real

### Already Working (no changes needed)
- Credit costs (UNLOCK_DAY: 60, SWAP: 5, REGEN: 10, AI_MESSAGE: 5, RESTAURANT: 5, HOTEL_SEARCH: 40, SMART_FINISH: 50, HOTEL_OPT: 100, MYSTERY: 15/5, TRANSPORT: 5)
- Per-trip free action caps (10 swaps, 5 regens, 20 messages, 5 recs) via `trip_action_usage` table
- Trip cost calculator with multi-city fees and complexity multipliers
- Flex credit packs (100/$9, 300/$25, 500/$39) with working Stripe prices
- Club packs structure (Voyager/Explorer/Adventurer) with base/bonus credit splits
- Founding member tracker table + `award_founding_member` RPC
- Credit balance tracking (`credit_balances` + `credit_ledger`)
- Spend logic (free credits first, then purchased)
- Monthly credit grants (150/month, 300 cap, 2-month expiry)
- Signup bonus (150 credits)
- Out-of-credits modal with purchase options
- Embedded checkout flow
- Webhook fulfillment for credit purchases
- Pricing page with Flex + Club sections
- `useFoundingMemberCount` hook

### Needs Price Update Only (Step 1)
| Pack | Current | New |
|------|---------|-----|
| Voyager | $29.99 | $49.99 |
| Explorer | $59.99 | $89.99 |
| Adventurer | $99.99 | $149.99 |

Create 3 new Stripe prices on existing products, update `src/config/pricing.ts` with new price IDs and amounts.

### Missing: New Features Required

#### A. `credit_purchases` Table + FIFO Spending (Large Change)
**Current:** Single counter in `credit_balances` (purchased_credits, free_credits). No per-purchase expiration tracking.
**Spec requires:** Individual purchase rows with different expiration dates (12mo for flex, never for club_base, 6mo for club_bonus), deducted in FIFO order by expiration.

**What this involves:**
1. New `credit_purchases` table with RLS
2. Rewrite `spend-credits` edge function to query `credit_purchases` rows ordered by `expires_at ASC NULLS LAST` and deduct across rows
3. Update `stripe-webhook` to insert into `credit_purchases` (flex = 1 row, club = 2 rows for base + bonus)
4. Update `grant-monthly-credits` to insert a `credit_purchases` row instead of just incrementing counter
5. Keep `credit_balances` as denormalized cache for fast reads
6. Migration script to convert existing purchased_credits into a single `credit_purchases` row
7. Update `useCredits` hook to optionally show breakdown by type/expiration

#### B. Group Unlocks (New Feature)
**Current:** Does not exist at all. No table, no UI, no Stripe products, no cap enforcement.
**Spec requires:** Per-trip group unlock purchase (Small $19.99 / Medium $34.99 / Large $79.99) with shared action caps (swaps, regens, chat, recs).

**What this involves:**
1. Create 3 new Stripe products + prices for group tiers
2. New `group_unlocks` table with RLS (collaborators can view)
3. Add `GROUP_CAPS` and `GROUP_UNLOCK_TIERS` config to `pricing.ts`
4. Update `spend-credits` to check group caps when a collaborator performs an action
5. Update `stripe-webhook` to handle group unlock fulfillment
6. Update `create-embedded-checkout` to pass group metadata (trip_id, tier)
7. New `GroupUnlockModal` UI component
8. New `useGroupUnlock` hook
9. Integration with existing collaboration system

#### C. `user_badges` Table (New Feature)
**Current:** `founding_member_tracker` exists but there's no general badge system.
**Spec requires:** `user_badges` table for club badges and founding member badges, displayed on profiles.

**What this involves:**
1. New `user_badges` table with RLS
2. Update `stripe-webhook` to award badges on club pack purchase
3. Badge display in profile UI

#### D. Voyager Perks Update (Small Change)
**Current perks:** `['Voyance Club badge', 'Credits never expire']`
**Spec perks:** Add "Priority support"

**Explorer perks** already include "Early access to new features" -- just verify alignment.

---

## Implementation Plan (Phased)

### Phase 1: Stripe Prices + Config Update
- Create 3 new Stripe prices (Voyager $49.99, Explorer $89.99, Adventurer $149.99)
- Create 3 new Stripe products + prices for Group Unlocks (Small $19.99, Medium $34.99, Large $79.99)
- Update `src/config/pricing.ts`:
  - New price IDs and amounts for Club packs
  - Add `GROUP_UNLOCK_TIERS` and `GROUP_CAPS` config
  - Add `FREE_ACTION_CAPS` for `transport_mode_change: 5` (spec says no free cap for this, remove if present)
  - Update Voyager perks to include "Priority support"
  - Update `perCredit` values

### Phase 2: Database Tables
- Create `credit_purchases` table (id, user_id, credit_type, amount, remaining, expires_at, source, stripe_payment_id, created_at, updated_at) with RLS (SELECT only for own rows)
- Create `group_unlocks` table (id, trip_id UNIQUE, purchased_by, tier, stripe_payment_id, caps JSONB, usage JSONB, created_at) with RLS (collaborators + owner can SELECT)
- Create `user_badges` table (id, user_id, badge_type, awarded_at, source, UNIQUE on user_id + badge_type) with RLS (SELECT own)
- Data migration: convert existing `credit_balances.purchased_credits` into `credit_purchases` rows for existing users

### Phase 3: Backend Edge Functions
- **`stripe-webhook`**: Update credit_purchase fulfillment to:
  - Insert into `credit_purchases` (flex: 1 row with 12mo expiry; club: 2 rows - base with NULL expiry, bonus with 6mo expiry)
  - Award badges via `user_badges`
  - Handle group unlock purchases (insert into `group_unlocks`)
  - Continue updating `credit_balances` as denormalized cache
- **`spend-credits`**: Rewrite deduction logic to:
  - Query `credit_purchases WHERE remaining > 0 AND (expires_at IS NULL OR expires_at > now())` ordered by expiration
  - Deduct FIFO across rows
  - Update `credit_balances` totals to stay in sync
  - For collaborator actions on group-unlocked trips, check group caps before charging
- **`grant-monthly-credits`**: Insert a `credit_purchases` row (type: free_monthly, 2mo expiry) in addition to updating `credit_balances`
- **`create-embedded-checkout`**: Add group unlock metadata (trip_id, tier) support

### Phase 4: Frontend Hooks and Components
- Update `useCredits` to query `credit_purchases` for expiration breakdown
- New `useGroupUnlock(tripId)` hook to check if a trip has group editing and remaining caps
- New `GroupUnlockModal` component (auto-selects tier based on collaborator count)
- Update `CreditBalanceCard` to show breakdown by credit type with expiration dates
- Badge display components for profiles

### Phase 5: Pricing Page Updates
- Update displayed prices to $49.99/$89.99/$149.99
- Add Group Unlock section
- Add "What credits buy" reference table
- Update FAQ if needed

---

## Risk Notes
- The FIFO spending logic is the most complex change. Race conditions during concurrent spending need to be handled (use row-level locking or transactions in the edge function).
- The `credit_balances` table stays as a fast-read cache. Both systems must stay in sync.
- Existing users with purchased credits need a one-time migration to create their initial `credit_purchases` row.
- Group unlock caps are shared across all collaborators on a trip, so the `spend-credits` function needs to check and increment `group_unlocks.usage` atomically.
