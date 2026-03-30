

# Fix: Missing Hotel Check-in, Checkout, and Airport Cards

## Problems Identified

Three distinct issues all traced to the **frontend deduplication/injection logic** in `EditorialItinerary.tsx`:

### 1. Hotel Check-in Missing (Day 1)
The backend repair (`repair-day.ts` line 293-336) correctly injects "Hotel Check-in & Refresh" on Day 1. However, on the **final departure day** (last day = also potentially a 1-day trip), the frontend dedup filter at **line 1868-1895** strips non-synthetic activities that start within 90 minutes of the synthetic departure card. If the check-in card falls within this window (unlikely for Day 1 unless it's a 1-day trip), it gets removed. More likely: the check-in card from AI generation is being matched by **line 1888** where `isGenericDeparture` catches `airport transfer` — but on Day 1, the real issue may be the mid-trip departure dedup at **line 1737-1749** running on the wrong day. Need to verify this isn't a backend issue where the check-in guarantee at line 294 (`needsCheckIn = dayNumber === 1`) simply isn't triggering because `hasCheckIn` returns true for some non-check-in accommodation card.

### 2. Hotel Checkout Missing (Last Day)
The AI generates a checkout card per the prompt. But the frontend filter at **line 1737-1749** (mid-trip departure day dedup) strips activities past the cutoff time. Checkout cards are NOT marked as synthetic (`__hotelCheckout`), so they get caught by `return actMin < cutoffMinutes`. The checkout card needs to be preserved.

### 3. "Departure Transfer" Goes to Lunch Instead of Airport
The synthetic departure card at **line 1661** creates title `${transportLabel} to ${to}` where `to = d.departureTo` — this is the **destination city name**, not the airport. So it reads "Transfer to Lisbon" instead of "Transfer to Airport". Additionally, the time-based trim at line 1747 may not be cutting activities after the departure correctly, allowing a lunch card to follow the "departure transfer."

## Changes

### File: `src/components/itinerary/EditorialItinerary.tsx`

**Fix 1 — Preserve checkout cards in both dedup filters:**
- Lines 1737-1749 (mid-trip departure dedup): Add checkout keyword detection so AI-generated checkout cards aren't stripped by the time cutoff.
- Lines 1868-1895 (final departure dedup): Same — preserve checkout and check-in cards from AI generation.

**Fix 2 — Preserve check-in cards in dedup filters:**
- Both filters should also preserve AI-generated check-in/accommodation cards (`category === 'accommodation'` or title contains check-in keywords).

**Fix 3 — Fix departure card title to reference airport/station, not city:**
- Line 1661: When `tType === 'flight'`, use the departure airport name from `details.departureAirport` or fall back to `"Airport"` — not the city name. For trains, use `details.departureStation`.
- Change from: `const title = \`${transportLabel} to ${to}\``
- Change to: Use the hub/station name for transport departure, and the city for the destination arrival.

**Fix 4 — Ensure activities after departure are properly trimmed:**
- The cutoff filter at line 1747 should also remove activities that start AFTER the departure card time, not just those within the buffer window. Currently `return actMin < cutoffMinutes` — but `cutoffMinutes` = `depMinutes - bufferMinutes`, meaning it KEEPS activities between cutoff and departure. These should also be removed since the traveler has left.

### File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`

**No changes needed** — the backend logic is correct. The check-in guarantee (line 293) and departure sequence repair (line 457) are working properly. The issue is purely frontend stripping.

## Summary of Edits

| Location | What | Why |
|---|---|---|
| `EditorialItinerary.tsx` ~1737 | Preserve checkout/check-in cards in mid-trip dedup | AI checkout cards stripped by time cutoff |
| `EditorialItinerary.tsx` ~1868 | Preserve checkout/check-in cards in final dedup | Same issue on final day |
| `EditorialItinerary.tsx` ~1661 | Use airport/station name in departure title | Currently says city name |
| `EditorialItinerary.tsx` ~1747 | Fix cutoff to also trim activities between buffer and departure | Activities after departure survive |

