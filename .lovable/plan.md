

# Combined Universal Fix — Plan

## Analysis: What Already Exists

After thorough codebase review, several of the requested features are **already implemented**:

- **Cross-day venue context** — `usedVenues` is already accumulated from ALL previous days and injected into the AI prompt as "VENUE DEDUP — DO NOT REVISIT THESE LOCATIONS" (compile-prompt.ts lines 1101-1115)
- **Fake address filtering** — HALLUCINATION FILTER already catches "the destination", "your destination", "the city", city-only addresses, and addresses < 10 chars (action-generate-trip-day.ts lines 778-822)
- **Cross-day restaurant dedup** — Two layers already exist: per-day dedup with replacement (lines 1126-1180) and trip-wide failsafe dedup (lines 1732-1967)
- **Restaurant pool tracking** — `used_restaurants` metadata already tracks and prevents restaurant repeats

## What Still Needs to Be Added

### 1. Universal Quality Rules in AI Prompt
**File:** `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

Add a new block in the system prompt (near the existing venue dedup section, ~line 1115) containing:
- Real restaurants only with full street addresses
- Local cuisine 70%+ rule
- Price reality tiers (street food €8-20, mid-range €25-55, upscale €60-100, fine dining €100-250)
- Meal timing by culture (France, Spain, Japan, Morocco, USA)
- Specific address requirement (not "the destination" or city-only)
- No same activity type on consecutive days
- Departure day light schedule rule

### 2. "table du quartier" in Fake Address Filter
**File:** `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

Add `'table du quartier'` to the existing `FAKE_ADDRESS_PATTERNS` or `BLOCKED_RESTAURANT_NAMES` array at line ~780. One-line addition.

### 3. Departure Day Cutoff Safety Net (Post-Generation Filter)
**File:** `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

After the existing hallucination filter (~line 822) and before the filler filter, add a departure day filter. The hoisted variables `_isLastDay` and `savedDepTime24Hoisted` are already available at this point in the file. The filter will:
- Only run when `_isLastDay` is true and departure time is known
- Apply 180min buffer for flights, 120min for trains (using `departureTransportType`)
- Remove activities starting after the cutoff (except checkout/departure cards)
- Log each removal

### 4. Cross-Day Non-Dining Venue Dedup Safety Net
**File:** `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

After the hallucination filter block, add a filter that uses the existing `usedVenues` array (already built from ALL previous days at lines 410-436) to remove non-dining activities that duplicate a venue from previous days. This catches cases where the AI ignores the prompt instruction (e.g., scheduling Louvre on Day 2 AND Day 4).

## Files to Modify
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add universal quality rules block
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — add "table du quartier" to blocked list, add departure cutoff filter, add cross-day venue dedup filter

## What This Does NOT Change
- No new files created
- No timing shifts or activity reordering — filters only REMOVE
- No changes to existing dedup, sanitization, or repair logic
- Existing transport, meal guard, and pricing pipelines untouched

