## Problem

On the last day in Paris, the itinerary shows:

```text
4:02 PM  Checkout from hotel
~        Transfer to airport (CDG)
4:36 PM  Stroll along the Seine     ← nonsensical, you're at the airport
8:36 PM  Departure flight
```

Two real bugs are colliding:

1. **Late checkout**: 4:02 PM is way past any normal hotel checkout time (~11 AM). The repair pass already has a "re-anchor checkout if too late" rule (`R5` in `repairDepartureSequence`), but it only fires when `LOGISTICS_SEQUENCE` validation has already flagged the day. With no breakfast / security card present, validation passes and the rule never runs.
2. **Leisure after airport transfer**: nothing in the pipeline treats the *airport-transport* card as a hard barrier. The "no activities after security" rule (`R3`) only triggers when there is an explicit "airport security" card. The post-departure time filter (`universal-quality-pass.ts` step 3) keeps anything that starts before `flight − 180min`, so a 4:36 PM stroll against an 8:36 PM flight slips through (4:36 < 5:36 cutoff).

The Day Truth Ledger / Logistics Sync Protocol in our core rules already mandates this kind of barrier — the implementation just isn't catching this shape of error.

## Fix

All edits in the departure-day repair pipeline. No schema changes, no UI changes.

### 1. Treat airport-transport as a hard barrier (`pipeline/repair-day.ts`)

Extend `repairDepartureSequence` (R3) so that when there is an `airport-transport` card on a departure day, **any non-departure activity scheduled after it gets moved to before it** (or removed if it can't fit without violating the 180-min flight buffer). Today this only triggers off `airport-security`; add `airport-transport` as an equally valid anchor.

### 2. Always run departure-day repairs on the last day

In the validate→repair loop, force `repairDepartureSequence` to run whenever `isLastDay` (or `isLastDayInCity && !isTransitionDay`) is true and a departure time is known — not only when `LOGISTICS_SEQUENCE` errors exist. This makes R5's checkout re-anchor (`latestCheckoutMins = depMins − 180 − transportDuration − 30`) reliably fire so a 4:02 PM checkout becomes ~11 AM and downstream activities get re-timed.

### 3. Tighten the post-departure time filter (`universal-quality-pass.ts`)

In step 3 ("Post-departure filter"), also drop any non-transport activity whose `startTime` is later than the airport-transport card's `startTime` on the last day. This is the safety net if repair-day misses it.

### 4. Surface a validation error so observability picks it up

Add a new check in `checkLogisticsSequence` (`pipeline/validate-day.ts`):

> If `airport-transport` exists on a departure day, every later non-departure activity is `LOGISTICS_SEQUENCE` error with `autoRepairable: true`.

This keeps the validate→repair contract honest and gives us a log line when this happens again.

### Out of scope

- Locked / manually-added activities are still respected (they will warn but not be moved/removed, per Universal Locking Protocol).
- No changes to credit charging — this is a generation-quality fix, not a structural mutation the user requested.

## Files touched

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — extend R3 anchor, force-run on last day
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — new "activities after airport-transport" check
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — airport-transport-aware post-departure filter
