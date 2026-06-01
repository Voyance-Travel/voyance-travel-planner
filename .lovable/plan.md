# Post-Check-in Loop / Inflated Airport→Hotel Walk Duration

## Root Cause

`repair-day.ts` §3b (the "RECONCILE" branch around line 1146) already overwrites any LLM-emitted airport→hotel transit card with `transferMinutes = input.airportTransferMinutes || 45` and a `Transfer to <hotel>` title. So the fix already exists — for the **standalone** generator path (`action-generate-day.ts`, line 1314) which threads `airportTransferMinutes` through from `compile-day-facts.ts:685` (`getAirportTransferMinutes(supabase, destination)`).

But the **chain generator** (`action-generate-trip-day.ts`, used by every real trip) calls `repairDay({...})` at line 1706 **without** passing `airportTransferMinutes` at all. Result:

- `input.airportTransferMinutes` is `undefined` → falls back to the generic **45-min** default.
- For destinations where the real airport transfer is materially different (e.g. Dublin DUB→Shelbourne ≈ 30 min), §3b still overwrites the LLM's 2hr 33min walk to 45 min — survivable.
- But the bigger gap: the chain path has **no destination-aware truth source**, so when the LLM emits a free-form transit card whose detection slips past `isAirportTransferCard` (idx > 3, oddly worded title), nothing else corrects it. The standalone path at least carried the real number forward.

## Fix (one path, ~15 lines)

### 1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

a. Import `getAirportTransferMinutes` from `./generation-utils.ts` (top of file, alongside existing utility imports).

b. Before the `repairDay({...})` call at line 1706, compute once per day:

```ts
const resolvedDestForTransfer = cityInfo?.cityName || destination;
const airportTransferMinutes = isFirstDay && resolvedDestForTransfer
  ? await getAirportTransferMinutes(supabase, resolvedDestForTransfer)
  : 45;
```

c. Add `airportTransferMinutes` to the `repairDay({...})` input object (anywhere alongside the other anchor fields like `arrivalTime24`, `hotelName`).

That's the entire surgical change. §3b in `repair-day.ts` already does the overwrite — it just needs the real number.

### 2. Memory update

Append to the **Flight Anchor Truth Parity** entry in `mem/constraints/itinerary/flight-anchor-truth-parity.md` a short note that the chain path now also threads `airportTransferMinutes` (via `getAirportTransferMinutes`) into `repairDay`, matching `action-generate-day.ts` and closing the "Walk to Hotel · 2hr 33min" leak on the chain path.

## Why not broaden §3b detection too?

Tempting, but out of scope. The user's request is explicitly: *"The function already exists. It's just not being applied at injection time."* If a follow-up leak appears (e.g. transit card at idx 4), we'd revisit `isAirportTransferCard` separately rather than expanding scope here.

## Out of scope (intentionally not changed)

- `repair-day.ts` §3b reconcile logic — already correct.
- `action-generate-day.ts` — already threads `airportTransferMinutes`.
- `getAirportTransferMinutes` itself — already returns destination-keyed minutes.
- `stripPreDawnHotelReturns` / `clampAllBookends` — those handle a different class (post-checkin loops), correctly per the user's note.

## Verification

- Sentinel `[Repair §3b] Reconciled LLM airport→hotel transfer "Walk to The Shelbourne" (… , Xmin) → "Transfer to The Shelbourne" (… , Ymin)` should now fire with Y matching the destination's real transfer (e.g. 30 for Dublin) instead of 45.
- Run existing test suite (`amsterdam.test.ts`, integrity-contract tests) — no behavioral change expected for cases that already passed 45.
