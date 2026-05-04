## Problem

Day 1's $161 "Local transit" persists because the previous fix only caught two title patterns:
- `Transfer/Travel to airport/station/...` (placeholder departure)
- `Taxi to X` (unconfirmed taxi)

It misses **mode-less generic hops** like `Travel to Four Seasons` ($76), `Travel to Sébillon Rivoli` ($4), `Travel to Spa` — there's no mode keyword and no airport keyword, so both guards fall through and the cost-reference lookup prices them as taxis.

## Fix

### 1. Backend: add a generic "unconfirmed transit" rule

In `supabase/functions/generate-itinerary/action-repair-costs.ts`, immediately after the existing `isUnconfirmedTaxi` branch, add:

```ts
const isGenericUnconfirmedTransit = category === 'transport'
  && !TRANSPORT_MODE_RE.test(_titleForPlaceholder)
  && !TRANSPORT_MODE_RE.test(_descForPlaceholder)
  && !isUserConfirmedCost
  && activity.booking_required !== true;
```

If true → write `cost_per_person_usd: 0`, `source: 'unconfirmed_transit'`, `notes: '[Choose a mode — taxi/metro/walk]'`. This is a strict superset of the placeholder-departure and unconfirmed-taxi rules, so they remain harmless but explicit.

`TRANSPORT_MODE_RE` already includes: `taxi|cab|uber|lyft|rideshare|private car|car service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat`. So a leg only earns a price if the user (or the AI) actually committed to a mode.

### 2. Frontend: extend the same guard

In `src/lib/cost-estimation.ts`, generalize `isUnconfirmedIntraCityTaxi` → `isUnconfirmedTransitLeg`: same exit conditions (`cost.basis = user/user_override`, `booking_required`, non-transport category) but the title check becomes "no mode keyword anywhere". Keep the old export name as an alias for backward compat.

In `src/hooks/usePayableItems.ts` both call sites (DB-driven transit branch ~line 291 and JSON-walk fallback ~line 401) use the new helper.

### 3. One-time data backfill

Run a SQL update to zero out existing `activity_costs` rows where:
- `category IN ('transport','transit','transfer','taxi','rideshare')`
- `cost_per_person_usd > 0`
- The matching itinerary activity title/description contains no mode keyword
- `cost.basis NOT IN ('user','user_override')` and `booking_required != true`

Tag with `source = 'unconfirmed_transit'`.

## Result

- Day 1 transit drops from $161 → $0 (each leg shown with a "choose a mode" hint).
- Future generations: any mode-less transport leg the AI invents stays $0 until the user picks taxi/metro/walk.
- Confirmed legs (user picked taxi, or it's a booked airport transfer with `booking_required=true`) still price normally.

## Files

- `supabase/functions/generate-itinerary/action-repair-costs.ts` — add generic branch
- `src/lib/cost-estimation.ts` — add `isUnconfirmedTransitLeg`
- `src/hooks/usePayableItems.ts` — swap to new helper at both call sites
- One-time SQL data update
- Memory update: rename `unconfirmed-intra-city-taxi-no-cost` → broader scope
