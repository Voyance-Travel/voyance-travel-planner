# Feature Implementation Audit - Source of Truth

> **Status**: Active tracking document  
> **Last Updated**: 2026-01-19  
> **Purpose**: Track what pricing features are actually enforced vs just listed

---

## Legend

- ✅ **Implemented & Enforced** — Backend checks, UI gates, fully working
- ⚠️ **Partially Implemented** — Logic exists but not fully wired/enforced
- ❌ **Not Implemented** — Listed on pricing page but no code exists
- 🔧 **Backend Only** — Entitlement flag exists but no UI enforcement

---

## Free Plan Features

| Feature | Status | Backend Flag | UI Gate | Notes |
|---------|--------|--------------|---------|-------|
| 1 full itinerary build | ✅ | `freeBuildsRemaining` | ItineraryPreview | Tracks in `user_usage.full_builds` |
| Save 1 draft trip | 🔧 | `limits.draftTrips: 1` | ❌ | Flag exists, no UI blocking |
| Keep built itinerary forever | ✅ | N/A | N/A | Just data persistence |
| Manual itinerary skeleton (DIY) | ⚠️ | N/A | N/A | UI exists but not clearly differentiated |
| Share trip link (view-only) | ✅ | N/A | GuestLinkModal | Works |
| Activity locking | ✅ | N/A | TripActivityCard | Works for all plans |

---

## Trip Pass Features

| Feature | Status | Backend Flag | UI Gate | Notes |
|---------|--------|--------------|---------|-------|
| Unlimited itinerary rebuilds | 🔧 | `unlocked_trips[]` | ❌ | Trip purchases tracked, not enforced in UI |
| Unlimited day builds & rebuilds | 🔧 | `unlocked_trips[]` | ❌ | Same as above |
| Transportation + route optimization | ⚠️ | `can_optimize_routes` | Partial | optimize-itinerary exists, not credit-gated |
| Weather tracker | ✅ | `limits.weatherTracker` | WeatherForecast | Works |
| Group budgeting tools | ✅ | `can_use_group_budgeting` | TripBudgetTracker | Enforced |
| Co-edit collaboration | 🔧 | `can_co_edit` | ❌ | Flag exists, no permission checks in UI |

---

## Monthly Plan Features

| Feature | Status | Backend Flag | UI Gate | Notes |
|---------|--------|--------------|---------|-------|
| Save up to 5 draft trips | 🔧 | `limits.draftTrips: 5` | ❌ | No UI blocking when limit reached |
| Mystery Trips (5 favorites) | ⚠️ | `limits.mysteryTripDrafts: 5` | MysteryGetawayModal | Modal exists, saving not implemented |
| Flight + hotel optimization | 🔧 | `can_use_flight_hotel_optimization` | ❌ | Flag exists, ranking logic exists, not gated |
| Trip versions (up to 4) | ❌ | `limits.tripVersions: 4` | ❌ | No versioning system built |
| Unlimited day builds & rebuilds | ✅ | `limits.dayRebuilds: -1` | DayRegenerateButton | Works |
| Co-edit collaboration | 🔧 | `can_co_edit` | ❌ | Collaboration exists but not permission-checked |
| Group budgeting | ✅ | `can_use_group_budgeting` | TripBudgetTracker | Works |
| Route optimization | ⚠️ | `can_optimize_routes` | ❌ | Logic exists, not gated in UI |
| Weather tracker | ✅ | `limits.weatherTracker` | WeatherForecast | Works |

---

## Yearly Plan Features

| Feature | Status | Backend Flag | UI Gate | Notes |
|---------|--------|--------------|---------|-------|
| Everything in Monthly | See above | - | - | - |
| Unlimited draft trips ("Trip Vault") | 🔧 | `limits.draftTrips: -1` | ❌ | No UI for "vault" concept |
| Unlimited Mystery Trip favorites | ❌ | `limits.mysteryTripDrafts: -1` | ❌ | Mystery trip saving not built |
| Unlimited trip versions | ❌ | `limits.tripVersions: -1` | ❌ | Versioning not built |
| **Preference learning over time** | ⚠️ | `limits.preferenceLearning` | ❌ | Engine exists but doesn't persist learned biases |
| **Saved presets & reusable templates** | ❌ | ❌ | ❌ | **Not implemented at all** |
| Trip history archive | ⚠️ | N/A | MemoryLane | MemoryLane shows past trips, no "archive" action |

---

## Credit/Pay-Per-Use Features

| Feature | Status | Backend Flag | Edge Function | Notes |
|---------|--------|--------------|---------------|-------|
| Build 1 day ($3.99) | ✅ | `credit_features.build_day` | consume-credits | Ready |
| Build full trip ($9.99) | ✅ | `credit_features.build_full_trip` | consume-credits | Ready |
| Route optimization ($1.99) | ✅ | `credit_features.route_optimize` | consume-credits | Ready |
| Group budget setup ($2.99) | ✅ | `credit_features.group_budget_setup` | consume-credits | Ready |
| Credit top-up (min $5) | ⚠️ | N/A | add-credits | Checkout works, webhook fulfillment needed |

---

## Priority Implementation Backlog

### High Priority (Blocking monetization)

1. ~~**Trip Pass enforcement in UI**~~ — ✅ Created `useTripPassCheck` hook
2. ~~**Draft trip limit enforcement**~~ — ✅ Created `useDraftLimitCheck` hook + `DraftLimitBanner`
3. ~~**Credit fulfillment webhook**~~ — ✅ Created `stripe-webhook` edge function
4. ~~**Saved presets removed from Yearly**~~ — ✅ Removed unbuilt feature from pricing
5. **Co-edit permission checks** — Only collaborators can edit, check `can_co_edit`

### Medium Priority (Promised features)

5. **Trip versioning system** — Save/restore different versions of same trip
6. **Preference learning persistence** — Save session bias to `travel_dna` after trip
7. **Mystery trip favorites** — Actually save and retrieve mystery trip favorites

### Low Priority (Nice-to-have)

8. **Saved presets & templates** — Let users save trip configs as templates
9. **Trip Vault UI** — Visual distinction for archived vs active trips
10. **Flight/hotel optimization gating** — Show "Voyance Picks" only to subscribers

---

## Entitlement Check Locations

### Backend (`get-entitlements`)
- `supabase/functions/get-entitlements/index.ts:34-69` — PLAN_LIMITS
- `supabase/functions/get-entitlements/index.ts:226-233` — Feature flags

### Frontend Hooks
- `src/hooks/useEntitlements.ts` — Main hook
- `src/components/common/UpgradePrompt.tsx` — Gate component
- `src/components/common/FeatureGate.tsx` — Wrapper component

### Feature Checks Needed At

| Location | What to Check |
|----------|--------------|
| `src/components/planner/steps/ItineraryPreview.tsx` | `can_build_itinerary`, `unlocked_trips` |
| `src/components/planner/DayRegenerateButton.tsx` | `can_build_day`, `unlocked_trips` |
| `src/pages/TripPlanner.tsx` | Draft count vs `limits.draftTrips` |
| `src/components/planner/budget/TripBudgetTracker.tsx` | `can_use_group_budgeting` |
| `src/components/itinerary/ItineraryEditor.tsx` | `can_co_edit` for non-owners |

---

## Related Documents

- `docs/SOT_METERED_CREDITS_SYSTEM.md` — Credit consumption details
- `docs/COST_AND_MONETIZATION_AUDIT.md` — Cost analysis
- `src/config/pricing.ts` — Frontend pricing config
