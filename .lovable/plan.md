## Plan: Make hotel-only regeneration fail visibly and recover safely

### 1) Stop treating shell itineraries as successful
- Update `getItinerary` / status handling so a trip with `itinerary_status = 'failed'` or `partial` is not returned to the UI as `ready` just because `itinerary_data.days` exists.
- Add a shared frontend completeness check that distinguishes:
  - real itinerary content
  - hotel/logistics-only days
  - empty shell days
- Use that check in `TripDetail.hasItineraryData` and related ready/self-heal paths so hotel-only output does not render as a normal 4-day itinerary.

### 2) Make regeneration completion use the same backend gate everywhere
- In `EditorialItinerary.handleRegenerateItinerary`, after day-by-day regeneration finishes, inspect the generated days before showing success.
- If the generated result is empty/hotel-only/bare:
  - persist `itinerary_status = 'failed'`
  - set `metadata.generation_failure_reason = 'empty_itinerary'` or `incomplete_itinerary`
  - preserve the shell days for diagnostics, but do not call it successful
  - do not show “Itinerary regenerated!”
- Align the `partial` status produced by `generate-trip-day` with the existing failure metadata expected by Budget/Coach gating.

### 3) Add an Itinerary-tab failure banner with retry
- Add a prominent recovery banner on the Itinerary tab when generation failed or produced hotel-only content.
- Message: generation finished without restaurants/activities/transit, and the user can retry.
- Button: `Regenerate itinerary`, wired to the existing regenerate handler.
- Keep the existing Budget tab warning, but make the Itinerary tab the primary place users see the failure.

### 4) Prevent phantom downstream behavior
- Ensure Budget Coach remains gated when `itinerary_status` is `failed` or `partial`, and when completeness check says hotel-only.
- Ensure All Costs can still show legitimate hotel/flight items, but over-budget/Coach warnings should not fire as if an empty itinerary were valid.

### 5) Regression coverage
- Add/extend tests around the shared completeness check:
  - 4 shell days, no activities → failed/empty
  - hotel-only activities → failed/incomplete
  - hotel + one paid item across multi-day trip → failed/incomplete
  - normal dining/activity/transit mix → ready
- Add a targeted test for empty + over-budget not producing Coach suggestions if an existing test harness is available.