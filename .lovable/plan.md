

## Audit: Itinerary Rules — What Works, What's Broken, What's Missing

### Test Methodology
- Traced both code paths (full-trip `generate-trip` and single-day `generate-day`/`regenerate-day`)
- Queried real `trip_cities` data from the database to validate data shape assumptions
- Smoke-tested edge function endpoints (401 not 500 — no crashes)
- Checked edge function logs for recent multi-city regenerations (none yet — new code untouched in production)

---

### ✅ Rules That Work

| Rule | Full-Trip Generation | Single-Day Regeneration |
|------|---------------------|------------------------|
| **1. Flight tracking** — single source, budget sync | ✅ `getFlightHotelContext` loads from `trips.flight_selection` | ✅ Same path |
| **2. Hotel tracking** — single source per city | ✅ `dayCityMap` resolves from `trip_cities.hotel_selection` | ✅ Transition resolver loads `hotel_selection` |
| **4. Arrival day** — hotel first, drop bags | ✅ `buildArrivalDayPrompt` + multi-city overlay "ARRIVAL DAY" | ✅ `isFirstDay` triggers same prompt |
| **5. Regular days** — correct hotel referenced | ✅ `effectiveHotelData` overrides per day | ✅ `resolvedHotelOverride` applied |
| **6. Non-flight departure** — no airport references | ✅ Prompt library routes to regular day + overlay injects train/bus constraints | ✅ `isNonFlightDeparture` gate at line 8289 |
| **7. Final day** — return flight departure | ✅ `buildDepartureDayPrompt` | ✅ `hasReturnFlight` logic |
| **8. Budget integration** — flight/hotel sync | ✅ `syncFlightToLedger` / `syncHotelToLedger` | N/A (frontend triggers) |
| **Hotel enforcement** — AI can't hallucinate hotel name | ✅ "🚫 CRITICAL: Use [name]..." in multi-city prompt | ✅ Hole 4 fix adds same enforcement |
| **Return flight leak** — stripped on non-flight days | ✅ "IGNORE any flight departure data" in overlay | ✅ Hole 1 fix strips `returnDepartureTime` |
| **Hotel change (split-stay)** — checkout/check-in pair | ✅ `isHotelChange` detection + "📍 HOTEL CHANGE" anchor | Partial (see below) |

---

### 🔴 Holes That Still Exist

**Hole A: Split-stay hotels without `checkInDate` are SILENTLY broken**
- Real data proof: Trip `1d5b1200` (Lisbon, 9 nights, 3 hotels) — ALL hotels missing `checkInDate` and `checkOutDate`
- The date-aware matcher can't match any hotel by date range → falls back to `hotelList[0]` for ALL 9 days
- The user sees 3 hotels in the UI but the AI uses only the first one for every day
- **Root cause**: The hotel selection UI (AddBookingInline or FindMyHotelsDrawer) doesn't always save `checkInDate`/`checkOutDate` — it saves `checkInTime`/`checkOutTime` (clock times) but not the calendar dates
- **Impact**: HIGH — split-stays are completely broken when dates aren't saved. This is likely the #1 source of "wrong hotel" bugs
- **Fix needed**: Frontend must save `checkInDate`/`checkOutDate` when user adds split-stay hotels. Backend fallback should infer dates by evenly dividing nights across hotels when dates are missing.

**Hole B: Full-trip path's `isLastDayInCity` says "Tomorrow the traveler takes a TRAIN" — but it's actually TODAY**
- Line 2030: `"Tomorrow the traveler takes a TRAIN to ${nextLegCity}"`
- But `isLastDayInCity` means this IS the departure day, not the day before. The train departs TODAY.
- The single-day regeneration path (line 8316) correctly says "DEPARTURE DAY: TRAIN TO [CITY]" — it knows it's today
- **Impact**: MEDIUM — the AI gets confused about whether the train is today or tomorrow. Sometimes generates a full sightseeing day instead of a departure day.
- **Fix**: Change "Tomorrow the traveler takes" to "The traveler departs today by" in the full-trip overlay

**Hole C: `isLastDayInCity` vs `isLastDay` collision on the final city**
- When the last day of the trip is ALSO the last day in the last city, both `isLastDayInCity` AND `isLastDay` are true
- In the prompt library (line 1473): `isMidTripCityDeparture = isLastDayInCity && !isLastDay` → false for the final day, so it correctly falls through to `buildDepartureDayPrompt`
- In the regeneration path (line 8286): `isMidTripCityDeparture = resolvedIsLastDayInCity && !isLastDay` → same, correct
- ✅ This case is handled correctly. No hole.

**Hole D: `isHotelChange` detection doesn't work in regeneration path**
- The transition resolver (line 7447-7554) resolves the hotel for the current day but does NOT check the previous day's hotel
- So if the user has a split-stay and regenerates the transition day, the AI won't generate checkout/check-in activities
- **Impact**: LOW-MEDIUM — split-stay hotel changes on regenerated days won't produce the checkout→check-in sequence
- **Fix**: Compare resolved hotel against the previous day's hotel (query one more day from trip_cities)

**Hole E: No `departureTime` in transport_details — confirmed by real data**
- Real data: Marrakech→Casablanca transport has `departureStation`, `operator`, `duration` but NO `departureTime`
- Code defaults to `10:30` (line 8298) — this is a guess, not real data
- The full-trip overlay at line 2036 checks `nextTd?.departureTime` — it won't fire, so no schedule injection
- **Impact**: MEDIUM — the generated departure timeline uses arbitrary times. But there's no better data available.
- **Fix**: Frontend builder should capture `departureTime`. Already tracked as task `4aa305ca`.

---

### ⚠️ Competing / Conflicting Rules

**Conflict 1: "Tomorrow" vs "Today" in checkout day prompt**
- Full-trip path says "Tomorrow the traveler takes a TRAIN" (line 2030)
- Single-day path says "DEPARTURE DAY: TRAIN TO [CITY]" (line 8316)
- These are for the SAME day but give the AI opposite instructions

**Conflict 2: Prompt library returns "regular day" for non-flight departures**
- Prompt library (line 1484): returns `buildRegularDayPrompt` for non-flight city departures
- Multi-city overlay (line 2031-2038): injects strong departure constraints
- Single-day path (line 8315-8358): builds complete departure timeline
- The full-trip path relies on the overlay to override a "regular day" base prompt — this is fragile. If the overlay text isn't strong enough, the AI generates a full sightseeing day with a checkout note at the end.

---

### Proposed Fixes (2 surgical changes)

**Fix A: Infer split-stay dates when missing** — `index.ts`, dayCityMap builder + transition resolver
When `hotelList.length > 1` but hotels lack `checkInDate`/`checkOutDate`, evenly distribute nights:
```
Hotel 1: day 0 → day floor(nights/numHotels) - 1
Hotel 2: day floor(nights/numHotels) → ...
```
~15 lines in each path. Also needs a frontend fix to save dates properly (separate task).

**Fix B: "Tomorrow" → "Today" in checkout day prompt** — `index.ts`, line 2030
Change:
```
"Tomorrow the traveler takes a TRAIN to ${nextLegCity}"
```
To:
```
"The traveler departs TODAY by ${transportLabelFullGen} to ${nextLegCity}"
```
1-line fix. Critical for preventing full-sightseeing-day hallucinations on departure days.

### Files
- `supabase/functions/generate-itinerary/index.ts` — Fix A (date inference) + Fix B ("tomorrow" → "today")

