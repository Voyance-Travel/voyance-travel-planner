

# Fix: Hotel Placeholder Cards When No Hotel Selected

## Problem

When a user skips hotel selection ("I'll add it later"), the system treats hotel as completely non-existent:

1. **Prompt tells AI "NO HOTEL BOOKED"** — `compile-day-schema.ts` explicitly says "Do NOT reference any hotel. No hotel check-in, no return to hotel" when `hasHotelData` is false
2. **PHANTOM_HOTEL validator strips accommodation cards** — `validate-day.ts` line 162: if `hasHotel === false`, every accommodation-category card is flagged as an error
3. **PHANTOM_HOTEL repair deletes them** — `repair-day.ts` line 92-106: strips all flagged phantom hotel cards (runs as step 1, before anything else)
4. **Check-in/checkout guarantees inject cards** — steps 9 and 10 re-inject check-in and checkout cards using `'Hotel'` as fallback name. These survive because they run after the strip
5. **BUT bookend repair is gated** — `repair-day.ts` line 265: `if (hotelName && hasHotel)` — mid-day "freshen up at hotel" and end-of-day "return to hotel" cards are **never injected** when no hotel is selected
6. **Net result**: Day 1 gets a bare "Hotel Check-in & Refresh" card (from guarantee), last day gets checkout, but standard days get zero hotel presence — no mid-day returns, no freshen up, no end-of-day returns

## Root Cause

The system conflates "no hotel name known" with "traveler has no accommodation." In reality, every traveler staying overnight has a hotel — they just haven't told us which one yet.

## Solution

Treat "no hotel selected" as "hotel exists but name unknown" — use placeholder cards with generic "Your Hotel" branding that get updated when the user adds a real hotel.

### Changes

#### 1. `repair-day.ts` — Remove `hasHotel` gate from bookend repair

**Line 265**: Change `if (hotelName && hasHotel && activities.length > 0)` to `if (activities.length > 0)`.

Use `hotelName || 'Your Hotel'` as the fallback. This ensures mid-day "freshen up" and end-of-day "return to hotel" cards always appear.

#### 2. `validate-day.ts` — Stop stripping placeholder accommodation cards

**Line 162-177**: `checkPhantomHotel` currently strips ALL accommodation cards when `hasHotel` is false. Change this to only strip cards that reference a **specific fabricated hotel name** (e.g., AI invents "Grand Lisboa Hotel" when none was booked). Preserve cards with generic titles like "Hotel Check-in", "Return to Hotel", "Freshen up at Hotel", "Your Hotel".

The check: if `hasHotel` is false and the accommodation card title contains a specific-sounding hotel name (not just "Hotel" or "Your Hotel"), flag it. Otherwise, allow it.

#### 3. `compile-day-schema.ts` — Add placeholder hotel instructions when no hotel selected

When `hasHotelData` is false, instead of "Do NOT reference any hotel", instruct the AI:

- "The traveler has NOT selected a specific hotel yet. Use 'Your Hotel' as a placeholder name."
- "Still include check-in, freshen-up, and return-to-hotel activities using 'Your Hotel'"
- "These will be updated with the real hotel name once selected"

This affects:
- Morning arrival without hotel (line ~154-174)
- Afternoon arrival without hotel (line ~206-223)  
- Day 1 no flight no hotel (line ~284-304)
- Last day no hotel (line ~689-734)

#### 4. `repair-day.ts` — Use consistent placeholder name

In check-in guarantee (line 307) and checkout guarantee (line 351), when `hotelName` is falsy, use `'Your Hotel'` instead of just `'Hotel'` for clarity that it's a placeholder.

#### 5. `hotelItineraryPatch.ts` — Already handles the update path

The existing `patchItineraryWithHotel` function already updates accommodation card titles/locations when a hotel is added later. This path is already correct — it finds cards by keyword matching and updates them with the real hotel name. No changes needed here.

### Files to modify

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/pipeline/repair-day.ts` | Remove `hasHotel` gate on bookend repair; use `'Your Hotel'` fallback |
| `supabase/functions/generate-itinerary/pipeline/validate-day.ts` | Allow generic accommodation cards when no hotel; only strip fabricated names |
| `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` | Replace "NO HOTEL" instructions with "use placeholder" instructions |

### Expected result

- Day 1: "Check-in at Your Hotel" card present (or real hotel name if selected)
- Standard days: "Freshen up at Your Hotel" mid-day card + "Return to Your Hotel" end-of-day card
- Last day: "Checkout from Your Hotel" card
- When user adds hotel later: `patchItineraryWithHotel` updates all "Your Hotel" references to the real name

