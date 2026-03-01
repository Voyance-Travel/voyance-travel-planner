
Goal: fix already-corrupted legacy trips (like Hong Kong) without forcing users to re-enter trip details, and add a top-level “Regenerate Itinerary” flow that preserves hotels/flights and original trip qualifiers while replacing corrupted scheduling/pricing.

What I verified in the current codebase
1) Legacy repair currently exists but is not wired into the user flow:
- `supabase/functions/backfill-activity-costs/index.ts` exists.
- I found no frontend invocation of `backfill-activity-costs` (no automatic run, no user-trigger).
- Result: existing trips can remain corrupted unless manually repaired out-of-band.

2) Your “Hong Kong still wrong” report is consistent with current state:
- Recent Hong Kong trips exist and have itinerary data.
- `activity_costs` rows are missing for those Hong Kong trip IDs in current data checks, so canonical totals/repair data may not be active for those trips.

3) Full regeneration can already reuse stored trip context:
- `generate-itinerary` `generate-full` reads trip-level data from DB (`trips`, `trip_cities`, `trip_intents`, metadata, etc.).
- So yes: re-running generation from stored trip context is feasible without re-entering details.

4) Current regenerate UX is not where you want it:
- A regenerate path exists via `TripConfirmationBanner`/generator flows, but there is no obvious top-of-itinerary “nuke-and-refresh” button in the main itinerary action area.

Implementation plan

Phase 1 — Make corrupted legacy trips repairable in-app (not manual-only)
A) Strengthen trip repair logic in `backfill-activity-costs`
- Improve matching beyond category-only fallback:
  1. destination + category + subcategory exact
  2. destination + category + item_name fuzzy match from activity title
  3. destination + category fallback
- Add keyword/subcategory mapping for transport and dining (e.g., taxi, airport bus, metro, ramen, dim sum) so “taxi” doesn’t inherit metro-like defaults.
- Add response stats by category + corrected count for transparent reporting.

B) Add safe per-trip repair action callable from app
- Add a new action in `generate-itinerary` (or a small dedicated backend function) like `repair-trip-costs`.
- It should:
  - authenticate user
  - verify owner/editor access to trip
  - run backfill logic for that trip only
  - return structured repair results
- This avoids exposing service-role-only functions directly from client.

C) Auto-repair trigger for legacy trips
- In `TripDetail`, after loading a trip with itinerary:
  - check if `activity_costs` rows are missing or clearly stale for that trip
  - run one-time repair silently (or with unobtrusive toast)
- This fixes old trips proactively the first time they’re opened post-release.

Phase 2 — Add top “Regenerate Itinerary” that preserves your setup
A) Add top-level action button in itinerary header
- Add button in the main Trip Summary actions row (same visible level as Share/Optimize/Save).
- Label: “Regenerate Itinerary”.

B) Add confirmation modal with explicit preservation contract
Default behavior:
- Keep:
  - flights (`flight_selection`)
  - hotels (`hotel_selection` and per-city hotels in `trip_cities`)
  - multi-city routing and transport legs (`trip_cities`, transport_type/details)
  - trip qualifiers from DB (`trip_type`, budget tier, metadata fields like must-do, first-time flags, children ages, commitments, trip intents)
- Replace:
  - day schedule (`itinerary_data.days`)
  - activity pricing (rewrite `activity_costs` from fresh generation path)

Optional toggle (advanced):
- “Preserve locked activities” off by default for “clean slate” regeneration.

C) Run full generation from persisted trip context (no re-entry)
- Reuse existing `ItineraryGenerator` + `generate-full` pipeline with current `tripId`.
- On completion:
  - overwrite itinerary day plan
  - ensure `activity_costs` rewritten for the new itinerary
  - keep flight/hotel/trip-level qualifiers unchanged

Phase 3 — Ensure all price displays converge immediately after repair/regeneration
A) Remove stale-estimate dominance where canonical data exists
- In `EditorialItinerary` total display, continue preferring canonical view total, but avoid silently falling back to estimated math when canonical data is expected but missing right after load.
- Trigger canonical refresh after repair/regenerate completes.

B) Payments/Budget consistency hardening
- `PaymentsTab` already reads `v_payments_summary` but still builds fallback payable items from itinerary estimates.
- Tighten behavior so repaired/canonical data is primary immediately after regeneration/repair.
- Keep fallback only for transitional states and show “repairing cost data…” status while syncing.

Phase 4 — UX for “too far gone” recovery
A) Add a second explicit action in same area:
- “Repair Pricing” (fast, no day rewrite): runs per-trip backfill/repair only.
- “Regenerate Itinerary” (full rewrite): replaces schedule + pricing but keeps user setup.

B) Messaging for user trust
- On complete, show summary:
  - rows repaired
  - outliers corrected
  - new trip total source
- This directly addresses uncertainty like “was old corruption actually fixed?”

Files to modify (planned)
Backend
1. `supabase/functions/backfill-activity-costs/index.ts`
- Better matching hierarchy + richer repair stats.
2. `supabase/functions/generate-itinerary/index.ts` (or new lightweight function)
- Add authenticated `repair-trip-costs` action with trip access checks.
3. (If needed) new migration for helper SQL function/view for “trip cost health” checks.

Frontend
4. `src/pages/TripDetail.tsx`
- Auto-check/trigger repair for legacy trips with missing canonical cost rows.
- Wire top-level regenerate + repair actions.
5. `src/components/itinerary/EditorialItinerary.tsx`
- Add top header actions/modal for “Repair Pricing” + “Regenerate Itinerary”.
- Refresh canonical totals after operations complete.
6. `src/components/itinerary/PaymentsTab.tsx`
- Prioritize canonical summary during and after repair.
7. `src/services/activityCostService.ts`
- Add helper methods for repair status checks and triggering repair action.

Security and access rules
- Keep user-scoped access via existing trip ownership/collaborator checks.
- No direct client path to service-role-only operations.
- Respect existing RLS behavior on `activity_costs` and reference tables.

Validation checklist before release
1) Open corrupted Hong Kong trip:
- Click “Repair Pricing”:
  - taxi-like outliers normalized via improved matching
  - canonical totals populate
  - header, budget, payments align
2) Click “Regenerate Itinerary”:
- flights/hotels/multi-city qualifiers preserved
- day plan and pricing refreshed from stored context
- no need to re-enter original trip form data
3) Confirm no regression:
- day-level regenerate still works
- locked activity behavior unchanged unless full-regenerate toggle says otherwise
4) Verify totals consistency:
- Trip Summary, Budget, Payments within canonical pipeline expectations

Expected user-facing outcome
- Corrupted historical trips get fixed without starting over.
- You can fully reset a “too far gone” itinerary from the top action button.
- Your original trip setup (dates, multi-city path, flights, hotels, asks/qualifiers) is preserved and reused.
- Pricing/scheduling are rebuilt cleanly with current guardrails.
