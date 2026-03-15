

## Credit Spend System — Cross-Path Audit

### Methodology

Traced every `spendCredits.mutateAsync` and `supabase.functions.invoke('spend-credits')` call across the codebase, compared charging patterns, and verified consistency with the server-side `spend-credits` edge function.

### All Credit Spend Paths Inventoried

| # | Component | Action | Pattern | tripId | Issue? |
|---|-----------|--------|---------|--------|--------|
| 1 | ItineraryGenerator | `trip_generation` | charge-before | ✅ | ✅ OK (pending charge + refund) |
| 2 | ItineraryGenerator | `REFUND` | refund | ✅ | ✅ OK |
| 3 | EditorialItinerary | `SWAP_ACTIVITY` | charge-before | ✅ | ✅ OK |
| 4 | EditorialItinerary | `REGENERATE_TRIP` | charge-before | ✅ | ✅ OK |
| 5 | EditorialItinerary | `ROUTE_OPTIMIZATION` | charge-before | ✅ | ✅ OK (refund on no-change) |
| 6 | EditorialItinerary | `REGENERATE_DAY` (×2) | charge-before | ✅ | ✅ OK |
| 7 | EditorialItinerary | `ADD_ACTIVITY` | conditional (aiLocked skip) | ✅ | ✅ OK (prior fix) |
| 8 | **ItineraryAssistant** | `AI_MESSAGE` | **charge-on-success** ✅ | ✅ | ✅ OK (gold standard) |
| 9 | ItineraryAssistant | `SWAP_ACTIVITY`/`REGENERATE_DAY` | charge-before-execute | ✅ | ✅ OK |
| 10 | **InlineModifier** | `AI_MESSAGE` | **charge-BEFORE-call** | ✅ | ❌ GAP 1 |
| 11 | InlineModifier | `SWAP_ACTIVITY`/`REGENERATE_DAY` | charge-before | ✅ | ✅ OK |
| 12 | **DNAFeedbackChat** | `AI_MESSAGE` | **charge-BEFORE-call** | ❌ missing | ❌ GAP 2 |
| 13 | SmartFinishBanner | `SMART_FINISH` | charge-before | ✅ | ✅ OK (refund path) |
| 14 | SmartFinishBanner | `REFUND` | refund | ✅ | ✅ OK |
| 15 | **MysteryGetawayModal** | `MYSTERY_GETAWAY` | **charge-BEFORE-call** | ❌ missing | ❌ GAP 3 |
| 16 | **MysteryGetawayModal** | `MYSTERY_LOGISTICS` | **charge-BEFORE-call** | ❌ missing | ❌ GAP 3 |
| 17 | TripConfirmationBanner | `HOTEL_OPTIMIZATION` | charge-before | ✅ | ✅ OK |
| 18 | useUnlockDay | `unlock_day` (direct invoke) | charge-before | ✅ | ✅ OK |
| 19 | useBulkUnlock | `group_unlock` (direct invoke) | charge-before | ✅ | ✅ OK |
| 20 | **generate-travel-blog** | `generate_blog` (inline deduct) | **self-managed** | ✅ | ❌ GAP 4 |

### Verified Working (No Gaps)

- **spend-credits edge function**: FIFO deduction, tier-aware free caps, group caps, route optimization sliding discount, idempotency, pending charges, refund path — all correct
- **FIXED_COSTS** match `CREDIT_COSTS` in `pricing.ts` for all 12 fixed actions
- **VARIABLE_COST_ACTIONS** correctly handle `trip_generation`, `hotel_search`, `group_unlock`, `regenerate_trip`
- **ACTION_MAP** in `useSpendCredits` covers all 16 action types
- **Free cap actions** (GROUP_CAP_ACTIONS) correctly limited to swap, add, regen, ai_message, restaurant_rec
- **transport_mode_change**: No free cap on server or client (consistent)
- **Balance sync** after every deduction, refund, and free-cap use
- **Deduplication guard** in `useSpendCredits` (pendingRef) prevents concurrent identical mutations
- **React Query retry disabled** for credit mutations (critical safety)
- **Prior fixes intact**: manual mode credit bypass, aiLocked guards, cost sync

---

### Gaps Found

#### GAP 1: InlineModifier Charges AI_MESSAGE Before Response + Skips for Paid Users (MEDIUM)

`InlineModifier.tsx` line 119-132 charges `AI_MESSAGE` credits **before** calling `sendChatMessage`. If the AI call fails (network error, rate limit, etc.), credits are deducted but the user gets nothing. This contradicts the **charge-on-success** pattern established in `ItineraryAssistant.tsx` line 220-234.

Additionally, it wraps the charge in `if (!isPaid)`, meaning paid users (club members) are never charged for AI messages in InlineModifier — but `ItineraryAssistant` charges all users and lets the server-side free cap decide. This creates an inconsistency where the same AI message action is free in one component and credit-gated in another.

**Fix**: Move the `spendCredits.mutateAsync` call to after the successful `sendChatMessage` response (charge-on-success pattern). Remove the `isPaid` skip — let the server-side free cap system handle it consistently.

**Files**: `src/components/itinerary/InlineModifier.tsx` (lines 118-133, 164)

---

#### GAP 2: DNAFeedbackChat Charges Before Response + Missing tripId + Skips for Paid (MEDIUM)

`DNAFeedbackChat.tsx` line 87-99 has the same two issues as InlineModifier:
1. Charges credits before the AI response (credit drain on failure)
2. Skips charging for paid users (`isPaid` guard)

Additionally, it passes **no `tripId`** to `spendCredits.mutateAsync`. This means the server-side free cap check (which requires `tripId` to look up `trip_action_usage`) is bypassed entirely — every message always costs 5 credits for non-paid users, even if they're within their free cap.

**Fix**: Move charge to after successful response. Remove `isPaid` skip. Since DNAFeedbackChat is profile-level (not trip-specific), the no-tripId behavior means free caps don't apply here, which may be intentional. If so, keep the no-tripId but document this as a deliberate design choice.

**Files**: `src/components/profile/DNAFeedbackChat.tsx` (lines 86-100)

---

#### GAP 3: MysteryGetaway Charges Before API Call With No Refund Path (MEDIUM)

`MysteryGetawayModal.tsx` charges `MYSTERY_GETAWAY` (15 credits) at line 128 and `MYSTERY_LOGISTICS` (5 credits) at line 245 **before** calling the respective edge functions. If `suggest-mystery-trips` or `mystery-trip-logistics` fails (network error, rate limit, 402, etc.), credits are permanently lost with no refund path.

Neither action passes `tripId` (correct — mystery trips don't exist yet), so no pending charge record is created for safety-net refunds.

**Fix**: Move both charges to after successful API responses (charge-on-success). Add error handling that only charges on HTTP 200 with valid data.

**Files**: `src/components/profile/MysteryGetawayModal.tsx` (lines 128, 245)

---

#### GAP 4: generate-travel-blog Self-Manages Credits (LOW)

The `generate-travel-blog` edge function (line 67-88) calls `deduct_credits_fifo` directly instead of routing through the `spend-credits` edge function. This means:
- No idempotency protection (duplicate blog generations can double-charge)
- No pending charge safety net
- Fragile manual balance sync (lines 91-116 use a non-standard sync approach)
- The `GENERATE_BLOG` entry in `ACTION_MAP` and `FIXED_COSTS` is unused

The blog function also doesn't check `generate_blog` against the edge function's `FIXED_COSTS`, so if the cost ever changes in `pricing.ts`, the blog function's hardcoded `20` won't update.

**Fix**: Refactor blog generation to call `spend-credits` from the client before invoking `generate-travel-blog`, matching all other action patterns. Remove the inline deduction from the edge function.

**Files**: `supabase/functions/generate-travel-blog/index.ts`, and the component that triggers blog generation

---

### Summary — Priority Order

1. **InlineModifier: charge-on-success + remove isPaid skip** — Prevents credit drain on AI failures
2. **MysteryGetaway: charge-on-success for both actions** — Prevents credit loss on API failures
3. **DNAFeedbackChat: charge-on-success + remove isPaid skip** — Consistency with ItineraryAssistant
4. **generate-travel-blog: route through spend-credits** — Idempotency + consistent balance sync

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 1 | `src/components/itinerary/InlineModifier.tsx` |
| GAP 2 | `src/components/profile/DNAFeedbackChat.tsx` |
| GAP 3 | `src/components/profile/MysteryGetawayModal.tsx` |
| GAP 4 | `supabase/functions/generate-travel-blog/index.ts` + client component |

