## "Just Tell Us" → Itinerary — Full System Audit

This audit traces every stage from chat input through generation, editing, payments, and budget, identifying gaps and broken patterns.

---

### PIPELINE STAGES REVIEWED

```text
1. Chat (TripChatPlanner) → 2. Confirm Card → 3. Start.tsx DB insert
→ 4. TripDetail ?generate=true → 5. Credit gate → 6. generate-itinerary (Edge)
→ 7. Enrichment (Google Places, Viator, Photos) → 8. Final save
→ 9. EditorialItinerary (UI) → 10. Chat/Discover/Swap editing → 11. Budget/Payments
```

---

### ✅ WORKING WELL

1. **7-stage generation pipeline** — Robust: context prep → AI generation → early save → enrichment → overview → final save → activity_costs write
2. **Multi-traveler DNA blending** — Owner 50% / guests 50% split, suggestedFor attribution, collaborator preferences merged
3. **Flight/hotel context injection** — Arrival/departure times constrain Day 1 and last day scheduling, hotel address correction post-generation
4. **Validation & retry loop** — Day-level validation with focused retry prompts, duplicate detection, dietary enforcement
5. **Multi-city journey architecture** — Sequential leg generation with self-chaining, transport mode awareness, per-city hotel injection
6. **Budget derivation** — User-set budget → subtract flight/hotel → per-day-per-person activity budget, per-city overrides for multi-city
7. **Version history** — Each day generation saves to `itinerary_versions` with DNA snapshot for undo
8. **Venue verification** — Dual-AI pipeline: cache → Google Places → semantic matching → 50km distance guard
9. **All editing lanes functional** — Chat (rewrite_day), Swap (get-activity-alternatives), Discover (proactive AI), Regenerate (full day)

---

### ⚠️ GAPS FOUND

#### **GAP 1: activity_costs NOT synced after chat/discover/swap edits** (HIGH)

When a user edits via the AI assistant (rewrite_day, swap, regenerate, filter, discover+add), the `itineraryActionExecutor.ts` calls `updateTripItinerary()` which ONLY updates `itinerary_data` JSON on the trips table. It does **NOT** update the `activity_costs` table. This means:

- Budget tab shows stale costs after edits
- "Expected Spend" doesn't reflect swapped activities
- Payments tab assignment list is outdated
The initial generation writes `activity_costs` in Stage 6 (line 4014-4067), but all subsequent edits bypass this table entirely.

**Fix**: After `updateTripItinerary()`, re-sync affected day's activity costs to `activity_costs` table. Add a `syncActivityCostsForDay()` helper that deletes old rows for the changed day_number and inserts the new ones.

#### **GAP 2: Batch parallel generation loses dedup context** (MEDIUM)

In `generateItineraryAI` (line 2831), days are generated in batches of 3 in parallel. But the `previousDays` array passed to each day in a batch only includes days from *completed* batches. Within a batch, Day 2 and Day 3 don't see each other's activities, so:

- Day 2 and Day 3 could both generate the same restaurant
- "AVOID REPEATING" dedup list is incomplete within a batch

**Fix**: Either reduce batch size to 1 (sequential, slower) or do a post-batch dedup pass that replaces duplicates.

#### **GAP 3: Discover-added activities don't persist to itinerary_activities table** (MEDIUM)

When a user adds an activity via the Discover drawer (`DiscoverDrawer.tsx` → `onAddActivity`), it updates the frontend state and the `itinerary_data` JSON. But it doesn't:

- Write to `itinerary_activities` (normalized table)
- Write to `activity_costs`
- Create a version history entry

This means the normalized tables drift from the JSON source of truth.

#### **GAP 4: No itinerary_data re-save after hotel/flight added post-generation** (MEDIUM)

When a user adds a hotel after generation via `AddBookingInline.tsx`, the hotel is saved to `trips.hotel_selection` and synced to `activity_costs` via `syncHotelToLedger`. But the `itinerary_data.days` are NOT updated to:

- Inject a "Hotel Check-in" activity with the correct hotel name
- Update accommodation references (existing "Hotel Check-in & Refresh" activities still reference the AI-generated hotel name)
- Add hotel coordinates to accommodation activities

The generation handles this beautifully when a hotel exists *before* generation (hotel address correction at line 2347). But post-generation hotel additions don't cascade into the itinerary.

**Fix**: When saving a hotel, optionally trigger a lightweight itinerary patch that updates accommodation activity titles/addresses.

#### **GAP 5: `executePacingAction` "more packed" is weak** (LOW)

The `more_packed` pacing adjustment (line 507-533) tries to add ONE activity by calling `get-activity-alternatives` with a generic "quick nearby experience" query. It:

- Doesn't know what time slot is free
- Hard-codes startTime to '15:00'
- Doesn't check for gaps in the schedule
- Doesn't update endTime

**Fix**: Analyze the day's schedule for the largest time gap, then request an activity that fits that window.

#### **GAP 6: `apply_filter` scope missing from chat AI tool definition** (LOW)

The `itinerary-chat` edge function's tool definition for `apply_filter` has a `scope` parameter, but the chat AI almost always defaults to full trip scope. There's no explicit guidance in the system prompt about when to scope to a single day vs the full trip.

#### **GAP 7: Weather data not refreshed post-generation** (LOW)

The `WeatherForecast` component uses weather from `itinerary_data` which is set at generation time. If a trip is generated weeks in advance, the weather data becomes stale. No mechanism refreshes weather closer to the trip date.

---

### EDGE FUNCTIONS — STATUS


| Function                    | Status    | Notes                                                                                                        |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `generate-itinerary`        | ✅ Working | All 6 actions: generate-full, generate-day, regenerate-day, generate-trip, generate-trip-day, save-itinerary |
| `itinerary-chat`            | ✅ Working | Tool calling with rewrite_day, swap, pacing, filter, regenerate                                              |
| `discover-proactive`        | ✅ Working | Archetype-aware proactive suggestions                                                                        |
| `get-activity-alternatives` | ✅ Working | Lane 1 swap support                                                                                          |
| `spend-credits`             | ✅ Working | Credit gate + refunds                                                                                        |
| `chat-trip-planner`         | ✅ Working | "Just Tell Us" chat, uses `getClaims()`                                                                      |
| `destination-images`        | ✅ Working | Photo fetching for enrichment                                                                                |
| `viator-search`             | ✅ Working | Booking URL matching                                                                                         |


No broken edge functions detected.

---

### RECOMMENDATIONS — PRIORITY ORDER

1. **Sync `activity_costs` after all editing operations** — This is the biggest gap. Budget/payments data goes stale after any edit.
2. **Post-batch dedup pass** — Add a trip-wide duplicate check after parallel batch generation completes.
3. **Hotel post-generation cascade** — When hotel is added/changed after generation, update accommodation activities in `itinerary_data`.
4. **Fix pacing "more packed" logic** — Analyze schedule gaps instead of hard-coding 15:00.
5. **Persist Discover-added activities** — Write to `itinerary_activities` and `activity_costs` when activities are added via Discover.
6. No Regressions in what currently works or changes in how it should work. 

---

### FILES INVOLVED IN FIXES


| Fix                         | Files                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| GAP 1 (activity_costs sync) | `src/services/itineraryActionExecutor.ts`, new `syncActivityCostsForDay()`                       |
| GAP 2 (batch dedup)         | `supabase/functions/generate-itinerary/index.ts` (lines 2830-2870)                               |
| GAP 3 (Discover persist)    | `src/components/itinerary/DiscoverDrawer.tsx`, `src/components/itinerary/EditorialItinerary.tsx` |
| GAP 4 (hotel cascade)       | `src/components/itinerary/AddBookingInline.tsx`, new itinerary patch utility                     |
| GAP 5 (pacing fix)          | `src/services/itineraryActionExecutor.ts` (lines 483-550)                                        |
