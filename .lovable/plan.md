
## What’s happening (based on code audit)

You already have the right underlying data model (`legs[]` with `isDestinationArrival` / `isDestinationDeparture`) and the itinerary cascade logic supports it. The current breakage is due to **two regressions**:

1) **The “starred” flags are being stripped when the trip is reloaded**, so the UI looks like it didn’t persist (and downstream logic falls back to heuristics).
- In `src/pages/TripDetail.tsx`, `normalizeFlightSelection()` returns legs that may include `isDestinationArrival`/`isDestinationDeparture`, but the code that maps normalized legs into `normalizedFlight.legs` **does not copy those flags** into the object passed to `EditorialItinerary`.
- Also, `TripDetail` sets `outbound = legs[0]` and `return = last leg`, ignoring the starred legs.

2) **Day 1 sometimes doesn’t update in the itinerary UI even after cascade runs** because the “refetch days after cascade” code in `EditorialItinerary` parses `itinerary_data` incorrectly:
- It uses `itData.days || itData.itinerary || []`, but `itData.itinerary` is usually an object like `{ days: [...] }`, so `setDays()` often never runs.

There’s a third structural reason this keeps recurring:
- You have **multiple flight editing flows** (Start step 2, AddBookingInline, MultiLegFlightEditor, itinerary flight card markers) with **different signatures / normalization**, and at least one of them (Start + MultiLegFlightEditor) uses “change signatures” that **ignore the star flags**, meaning toggling a star doesn’t propagate state.

---

## Goals (what we’ll make true)

1) Users can:
- **Star exactly one leg as “Final destination arrival (outbound)”**
- **Star exactly one leg as “Departure from destination (return)”**
- **Reorder legs freely** in both Step 2 (outside) and inside the itinerary

2) Those choices:
- **Persist to the backend**
- **Survive reloads**
- **Drive Day 1 / last-day scheduling** (via cascade) and **drive any regeneration prompts** (via backward-compatible `flight_selection.departure` and `flight_selection.return`)

3) “Refresh” behavior stays as you chose: **Validation refresh** (not a rewrite). We’ll add a separate clearly-labeled “Sync itinerary to flight times” action to re-run cascade when needed (free, no credits).

---

## Implementation plan (no schema changes required)

### A) Fix persistence + reload: stop stripping starred flags
**Files: `src/pages/TripDetail.tsx`**

1. When building `normalizedFlight.legs`, include:
- `isDestinationArrival`
- `isDestinationDeparture`

2. When setting:
- `normalizedFlight.outbound`: choose the leg where `isDestinationArrival === true` (fallback to existing heuristic if none).
- `normalizedFlight.return`: choose the leg where `isDestinationDeparture === true` (fallback to last leg).

**Result:** After you star a leg and `onBookingAdded()` refetches the trip, the UI still shows the star and uses the correct leg.

---

### B) Fix “Day 1 didn’t update” after starring: correct itinerary refetch parsing
**File: `src/components/itinerary/EditorialItinerary.tsx`**

Update the post-cascade refetch logic to correctly read days from any supported shape:
- Prefer `itinerary_data.days`
- Fallback to `itinerary_data.itinerary?.days`
- (Optional safety) fallback to `parseEditorialDays(refreshed.itinerary_data, startDate)` so we never silently fail.

**Result:** When the cascade adjusts Day 1 or last day, the itinerary view updates immediately without reload.

---

### C) Ensure backward-compat fields match the starred legs (so regeneration uses the right times)
Right now your backend generation path (`supabase/functions/generate-itinerary/*`) reads mostly from:
- `flight_selection.departure.arrival.time` (Day 1 timing)
- `flight_selection.return.departure.time` (last day cutoff)

So we must ensure those legacy fields always reflect the user-starred legs.

**Files:**
- `src/utils/normalizeFlightSelection.ts` (the builder)
- `src/components/itinerary/EditorialItinerary.tsx` (marking handler)

Changes:
1. Update `buildFlightSelectionFromLegs()` so:
- `departure` is set from `isDestinationArrival` leg (already done)
- `return` is set from `isDestinationDeparture` leg (currently it always uses “last leg”)

2. In `handleMarkFlightLeg()` inside `EditorialItinerary`, when updating `updatedSelection.return`, also prefer the starred departure leg (not always last).

3. Fix minor field mismatch in legacy objects: use consistent cabin field naming (`cabin` vs `cabinClass`) to avoid downstream consumers missing cabin class.

**Result:** Even if a regeneration happens server-side, it will use the starred arrival/departure windows.

---

### D) Make “reorder legs” and “star legs” work in Step 2 (outside page) and persist into trip creation
**Files:**
- `src/components/planner/flight/MultiLegFlightEditor.tsx`
- `src/pages/Start.tsx`

#### D1) Add starring controls in MultiLegFlightEditor
- Add “Star as final destination arrival” toggle
- Add “Star as departure from destination” toggle
- Enforce exclusivity: only one arrival-star and one departure-star at a time.

#### D2) Add drag-and-drop reorder for legs in MultiLegFlightEditor
You already have a great dnd-kit pattern in `DraggableActivityList.tsx`. We’ll reuse the same approach for flight leg slots:
- `DndContext` + `SortableContext` + `arrayMove`
- Drag handle icon already imported (`GripVertical`), so this matches existing design.

Important: when reordering, we must reorder the emitted `ManualFlightEntry[]` accordingly.

#### D3) Fix “star doesn’t propagate” in Step 2 due to signature keys ignoring the star flags
Currently, both `MultiLegFlightEditor` and `Start.tsx` compute signatures that exclude:
- `isDestinationArrival`
- `isDestinationDeparture`

So toggling a star can be considered a “no-op” and never reaches parent state.

We will:
- Include both flags in all “signature” builders used to dedupe emissions:
  - MultiLegFlightEditor: `lastEmittedSignature` calculations
  - Start.tsx: `normalizeLegs().makeKey` and `lastMultiLegSig` signature

#### D4) Persist the starred flags when creating `flight_selection` on submit
In `Start.tsx`, when mapping `ManualFlightEntry → FlightLeg`, include:
- `isDestinationArrival`
- `isDestinationDeparture`

Then use the improved `buildFlightSelectionFromLegs()` (from section C) so departure/return legacy fields align with starred legs.

**Result:** Step 2 marks + reorder will be included in the saved trip and used by itinerary building.

---

### E) Ensure starring survives “Edit Flight Details” modal inside itinerary
**File: `src/components/itinerary/EditorialItinerary.tsx`**

When passing `existingLegs` into `AddFlightInline` for edit mode, include:
- `isDestinationArrival`
- `isDestinationDeparture`

Otherwise, opening edit flight can silently “drop” the stars.

---

### F) Add a dedicated “Sync itinerary to flight times” action (free) to avoid confusion with Refresh/Regenerate/Optimize
Because your chosen “Refresh” = validation (not rewrite), and users still need a clear way to “rebuild timing around flights” after importing/starring.

**File: `src/components/itinerary/EditorialItinerary.tsx`**

Add a button near the Flight section (and/or near Optimize) labeled something like:
- “Sync itinerary to flight times”

Behavior:
- Calls `runCascadeAndPersist(tripId, days, flight_selection, tripCities?)`
- Refetches itinerary days using the fixed parser (section B)
- Shows a toast describing what changed

No credit spend; this is purely aligning schedule windows to already-entered booking times.

---

## Acceptance checklist (how we’ll verify)

1) In itinerary → Flight section:
- Star a leg as destination arrival → reload page → star still shown.
- Day 1 activities shift appropriately (later start if arrival is later).
- Star a leg as destination departure → last day truncates appropriately.

2) In Start Step 2:
- Import multi-leg flights → reorder legs → star a leg → submit trip
- Open trip itinerary → same order + stars present.

3) Edit Flight Details modal:
- Stars are still present in the editor
- Saving does not remove them.

4) “Refresh” continues to be validation-only.
5) “Sync itinerary to flight times” updates Day 1/last day reliably.

---

## Files we expect to touch
- `src/pages/TripDetail.tsx` (preserve flags + select outbound/return by flags)
- `src/components/itinerary/EditorialItinerary.tsx` (refetch parsing fix, legacy field alignment, edit modal preserves flags, add Sync button)
- `src/utils/normalizeFlightSelection.ts` (return leg selection in builder)
- `src/components/planner/flight/MultiLegFlightEditor.tsx` (star UI + reorder + signature includes flags)
- `src/pages/Start.tsx` (signature includes flags + submit includes flags)

No database migrations required.

---

<lov-actions>
<lov-suggestion message="Test end-to-end: star destination arrival/departure legs, reload the page, and confirm Day 1 + last-day times update correctly. Also test creating a new trip from Step 2 with reordered legs and starred legs.">Verify end-to-end</lov-suggestion>
<lov-suggestion message="Add a dedicated “Sync itinerary to flight times” button in the itinerary so users can rerun the transport cascade anytime without regenerating content or spending credits.">Add Sync button</lov-suggestion>
<lov-suggestion message="Unify flight editing by reusing a single shared FlightLegEditor component across Step 2 and the itinerary, to prevent regressions like dropped flags and missing reorder controls.">Unify flight editor</lov-suggestion>
<lov-suggestion message="Add a small ‘Flight timing window’ banner on Day 1 and the last day showing which leg is currently driving scheduling (with a quick link to change the starred leg).">Show scheduling driver</lov-suggestion>
<lov-suggestion message="Add an activity-level warning when a Day 1 activity starts before the post-arrival buffer, with a one-click ‘Sync to flight times’ fix.">Add timing warnings</lov-suggestion>
</lov-actions>
