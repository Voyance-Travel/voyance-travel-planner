

# Fix Phantom Hotel Activities

## Root Cause Analysis

The phantom hotel problem has **three layers**:

1. **Prompt layer (most critical)**: `compile-prompt.ts` lines 418, 425-429 unconditionally tell the AI to create hotel activities ("Breakfast at hotel", "Return to Hotel", "Hotel checkout") regardless of whether a hotel is booked. The `hotelNameForDay` variable falls back to empty string but the hardcoded template text still references "hotel" directly.

2. **Prompt layer (compile-day-schema.ts)**: Similarly injects hotel references into day-1 and last-day schemas without checking `hasHotel`.

3. **Post-processing gap in action-generate-day.ts**: Line 254 has a comment saying "Phantom hotel stripping is now handled by pipeline/validate-day + repair-day" — but `validate-day` and `repair-day` only strip phantoms when `hasHotel: false`, and the `hasHotel` flag on line 766 is derived from `flightContext.hotelName` which can be populated from `paramHotelName` even when no hotel is actually booked.

4. **Meal fallback in day-validation.ts**: Line 753 uses "café near your hotel" as a generic venue suffix even when no hotel exists.

## Changes

### 1. `compile-prompt.ts` — Conditionally include hotel instructions

- Lines 418, 425-426, 428-429: Wrap the hotel-referencing instructions in a check for `flightContext.hotelName`. When no hotel is booked:
  - Breakfast instruction: "At a well-reviewed local café. Do NOT reference any hotel."
  - Remove "HOTEL RETURN" instruction (line 425-426)
  - Remove "RETURN TO HOTEL" instruction (line 428)
  - Line 460-461: Already conditional on `hotelNameForDay`, but add explicit "Do NOT reference any hotel in the itinerary" when empty

### 2. `compile-day-schema.ts` — Guard hotel references on day 1 and last day

- Where `hasHotelData` is checked (lines 36, 337): ensure that when false, no hotel transfer/check-in/checkout activities are injected into the schema constraints.

### 3. `action-generate-day.ts` — Re-add phantom stripping

- After line 254 (where the misleading comment is), add the actual `stripPhantomHotelActivities` call:
```typescript
const hasHotel = !!(flightContext as any).hotelName && paramHotelName;
if (!hasHotel) {
  stripPhantomHotelActivities(generatedDay, false);
}
```

### 4. `sanitization.ts` — Expand patterns

Add missing patterns to `PHANTOM_HOTEL_TITLE_PATTERNS`:
- `/\bnear your hotel\b/i`
- `/\bat your hotel\b/i`
- `/\bcafé near.*hotel\b/i`
- `/\bsettle in\b/i` (when category is accommodation and no hotel)

### 5. `day-validation.ts` — Fix generic meal fallback

- Line 753: Change "café near your hotel" to "local café" and remove "ask your hotel" from the description when no hotel context is available.

### 6. `generation-core.ts` — Verify existing stripping

- Line 1568-1571: Already calls `stripPhantomHotelActivities` — verify `dayCity?.hotelName` is correctly resolved from trip_cities hotel_selection (not just a parameter name).

## Files to modify
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/sanitization.ts`
- `supabase/functions/generate-itinerary/day-validation.ts`

## No new files, no pipeline flow changes, no self-chaining modifications.

