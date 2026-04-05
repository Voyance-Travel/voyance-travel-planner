

## Fix "Breakfast at a local spot" Placeholder — Ensure Real Restaurant Names

### Root Cause

The problem originates in `day-validation.ts` → `enforceRequiredMealsFinalGuard`. When the meal guard needs to inject a missing meal and no `fallbackVenues` match, it calls `getDestinationHint()` which returns a generic `venueSuffix` like `"local spot"`. The title then becomes `"Breakfast at a local spot"`.

Two issues:
1. **Lisbon is not in `DESTINATION_MEAL_HINTS`** — so it falls through to the generic `"local spot"` fallback instead of getting a Lisbon-specific venue type (e.g., "pastelaria").
2. **`validate-day.ts` catches `"Breakfast at a local spot"` as `GENERIC_VENUE`** but `repair-day.ts` has **no handler for `GENERIC_VENUE`** — the validation warning is logged but never acted on. The placeholder survives to the UI.

### Plan

**File 1: `supabase/functions/generate-itinerary/day-validation.ts`**
- Add `lisbon` to `DESTINATION_MEAL_HINTS` with Lisbon-specific venue types: `pastelaria` for breakfast, `tasca` for lunch, `restaurante` for dinner.
- Change the generic fallback `venueSuffix` values from `"local spot"` to venue-type descriptions that won't trigger the generic venue detector (e.g., `"neighborhood café"` → actually, the real fix is below).

**File 2: `supabase/functions/generate-itinerary/pipeline/validate-day.ts`**
- Add `"Breakfast at a local spot"` pattern variants to `GENERIC_VENUE_PATTERNS` (already partially covered at line 39, but ensure `"at a local spot"` without meal prefix also matches).
- Escalate all `GENERIC_VENUE` findings on dining activities to `severity: 'error'` (not just `isMealInCity`), making them `autoRepairable: true`.

**File 3: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**
- Add a `GENERIC_VENUE` repair handler that:
  - Checks `fallbackVenues` for an unused real venue matching the meal type
  - If found, replaces the title and `venue_name` with the real venue
  - If not found, logs a warning but at minimum replaces `"a local spot"` with a destination-aware venue type from `getDestinationHint`

**File 4: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**
- Add explicit instruction: "Every dining activity MUST include a SPECIFIC, REAL restaurant name. Never use generic placeholders like 'a local spot', 'a nearby café', or 'a local restaurant'. If unsure, use the hotel restaurant or a well-known local chain."

### Files to edit
- `supabase/functions/generate-itinerary/day-validation.ts` — add Lisbon hints, improve generic fallback
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — escalate generic venue on dining to error
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add GENERIC_VENUE repair handler
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — strengthen restaurant naming rules

### Verification
Generate a 4-day Lisbon trip. Every breakfast, lunch, and dinner should show a specific restaurant name. No "local spot", "the destination", or generic placeholder should appear.

