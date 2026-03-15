## Single-City Itinerary — End-to-End Audit

### Flow Traced

```text
Start.tsx (Form/Chat) → DB insert (trips + trip_cities) → navigate(/trip/X?generate=true)
→ TripDetail.tsx detects ?generate=true → ItineraryGenerator component
→ useGenerationGate (credit check) → supabase.functions.invoke('generate-itinerary', { action: 'generate-full' })
→ Edge Function: Stage 1 (context) → Stage 2 (AI batch gen) → Stage 3 (enrichment) → Stage 6 (final save + activity_costs)
→ useGenerationPoller detects itinerary_status='ready' → onComplete → EditorialItinerary UI
→ Editing: ItineraryAssistant (chat), Swap, Discover, Pacing
→ Budget/Payments tabs read from activity_costs views
```

### ✅ Working Well

1. **Single-city context prep** — `is_multi_city=false` skips the multi-city day map entirely; destination/dates/budget flow cleanly
2. **Flight/hotel injection** — `flight-hotel-context.ts` correctly reads `flight_selection` + `hotel_selection` from trips table for single-city; constrains Day 1 arrival and last day departure
3. **Credit gate** — `useGenerationGate` correctly calculates cost at 60 credits/day, handles partial/locked/full modes
4. **7-stage pipeline** — All stages execute correctly for single-city: no multi-city branching interference
5. **Post-edit cost sync** — `ItineraryAssistant.tsx` already calls `syncActivitiesToCostTable` AND `cleanupRemovedActivityCosts` after chat/swap/regenerate edits (this was fixed in the previous round)
6. **EditorialItinerary cost sync** — Direct activity edits (drag, remove, add from Discover) also sync to `activity_costs`
7. **Hotel post-gen cascade** — `hotelItineraryPatch.ts` correctly updates accommodation activities when hotel is added after generation
8. **Post-batch dedup** — Already implemented (previous round fix)
9. **Smart pacing** — Gap analysis already implemented (previous round fix)
10. **All 3 editing lanes** — Chat (rewrite_day), Swap (get-activity-alternatives), Discover (proactive AI) all functional

### ⚠️ Gaps Found

#### **GAP 1: Single-city `trip_cities.country` is always NULL** (LOW)

Both the form path (line 2560) and the chat path (line 2991-3001) insert single-city `trip_cities` rows with `country: null`. The `trips` table stores `destination_country`, but this value is never propagated to `trip_cities` for single-city trips. This matters for:

- Budget category scaling (cost references are country-dependent)
- The `trip_cities` budget summary view which shows per-city breakdowns
- Any future feature that queries `trip_cities.country`

**Fix**: Set `country` to `trip.destination_country` (or parse from destination string) when inserting single-city `trip_cities` rows.

#### **GAP 2: Chat-path single-city `trip_cities` missing `hotel_selection**` (MEDIUM)

The form path (line 2566) correctly passes `hotel_selection` to the single-city `trip_cities` row. But the chat path (lines 2991-3001) does NOT include `hotel_selection` at all. If a user selects a hotel during the "Just Tell Us" chat flow, it won't be persisted to `trip_cities.hotel_selection`.

This means the generation edge function's multi-city hotel injection path (which reads `trip_cities.hotel_selection`) won't find the hotel for single-city chat trips. The fallback to `trips.hotel_selection` works, but there's a schema inconsistency. 

They are different paths- a user would not add a hotel through chat or through mutli city. They would only add it through the single city path - on step 2. 

**Fix**: In the chat path's single-city insert block, include `hotel_selection` from the trip's hotel data if available.

#### **GAP 3: `trip_cities.generation_status` never updated to 'complete'** (LOW)

Both paths insert `generation_status: 'pending'`, but after generation succeeds, only `trips.itinerary_status` is updated to `'ready'`. The `trip_cities.generation_status` stays `'pending'` forever for single-city trips. This is a data hygiene issue — any UI or query filtering by `generation_status` would show incorrect state.

**Fix**: After successful generation in the edge function (Stage 6), update `trip_cities.generation_status = 'complete'` and `days_generated = totalDays` for the trip's cities.

#### **GAP 4: Flight post-gen cascade missing** (MEDIUM)

The `hotelItineraryPatch.ts` was added for hotel changes, but there's no equivalent for flights. When a user adds/changes a flight after generation:

- The flight is saved to `trips.flight_selection`
- `activity_costs` gets a flight entry via ledger sync
- But `itinerary_data` Day 1 and last day are NOT updated with the real arrival/departure times
- Activities that were scheduled based on "default" arrival time (e.g., morning) could now conflict with a late-afternoon flight arrival

**Fix**: Create `patchItineraryWithFlight()` similar to `patchItineraryWithHotel()` that adjusts Day 1 and last day activity times based on actual flight times.

#### **GAP 5: No itinerary version bump after edits** (LOW)

The `optimistic_update_itinerary` DB function increments `itinerary_version` for concurrent edit protection. But direct `updateTripItinerary()` calls from `itineraryActionExecutor.ts` do a raw `.update({ itinerary_data })` without using the optimistic function, so `itinerary_version` is never incremented. This means:

- Concurrent edits from collaborators could silently overwrite each other
- Version history tracking is incomplete

**Fix**: Use `optimistic_update_itinerary` RPC in `updateTripItinerary()` instead of raw update.

### Edge Functions — Status


| Function                    | Status    | Notes                                        |
| --------------------------- | --------- | -------------------------------------------- |
| `generate-itinerary`        | ✅ Working | All actions tested, no recent errors in logs |
| `get-activity-alternatives` | ✅ Working | Used by swap + pacing                        |
| `itinerary-chat`            | ✅ Working | Chat editing lane                            |
| `discover-proactive`        | ✅ Working | Discover lane                                |
| `spend-credits`             | ✅ Working | Credit gate + refunds                        |
| `destination-images`        | ✅ Working | Photo enrichment                             |
| `viator-search`             | ✅ Working | Booking URL matching                         |


No broken edge functions detected.

### Recommendations — Priority Order

1. **Add** `hotel_selection` **to chat-path single-city** `trip_cities` **insert** — Schema consistency fix - there is not chat for single city just the hotel step 2 add hotel component 
2. **Create `patchItineraryWithFlight()**` — Flight post-gen cascade (mirrors hotel patch)
3. **Populate `trip_cities.country` for single-city trips** — Use `destination_country` from trips table
4. **Update `trip_cities.generation_status` after generation** — Data hygiene
5. **Use `optimistic_update_itinerary` for edit writes** — Concurrent edit protection

### Files Involved


| Fix                       | Files                                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| GAP 1 (country)           | `src/pages/Start.tsx` (lines 2560, 2991-3001)                             |
| GAP 2 (hotel_selection)   | `src/pages/Start.tsx` (lines 2991-3001)                                   |
| GAP 3 (generation_status) | `supabase/functions/generate-itinerary/index.ts` (after Stage 6 save)     |
| GAP 4 (flight cascade)    | New `src/services/flightItineraryPatch.ts`, integrate in booking flow     |
| GAP 5 (version bump)      | `src/services/itineraryActionExecutor.ts` → use RPC instead of raw update |
