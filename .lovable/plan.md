

# Fix: DNA Attribution Dots Showing on Non-DNA-Driven Activities

## The Problem

The prompt tells the AI: **"EVERY activity MUST have a suggestedFor value — no exceptions."** This forces the model to attribute hotel check-ins, airport arrivals, and other logistical activities to specific travelers, even though those activities have nothing to do with anyone's travel DNA. The result is confusing dots on activities like "Hotel Check-in" or "Airport Arrival" that no traveler's personality "inspired."

Additionally, the same must-do activity (e.g., US Open) gets attributed to different travelers on different days seemingly at random, because the AI is guessing who it "belongs" to each time.

## The Fix (Two Layers)

### 1. Prompt: Stop requiring attribution on logistical/user-specified activities

Update the `suggestedFor` instructions in **both** prompt locations (full generation ~line 1783 and day-rewrite ~line 8446) in `supabase/functions/generate-itinerary/index.ts`:

- **Logistical activities** (hotel check-in/check-out, airport arrival/departure, transfers, transit) → set `suggestedFor` to **all traveler IDs combined** (comma-separated), or omit entirely
- **User-specified must-dos** (US Open, specific restaurants the user requested) → set `suggestedFor` to **all traveler IDs** since these were requested by the group, not driven by any individual's DNA
- **Only AI-chosen activities** (restaurants, bars, experiences the AI picked based on personality traits) should get single-traveler attribution

### 2. Frontend: Filter out attribution dots on logistical activity types

In `src/components/itinerary/EditorialItinerary.tsx`, suppress the attribution badge for activity types that are inherently non-DNA-driven. Use the existing `nonReviewableTypes` list (which already identifies hotel, check-in, airport, transfer, etc.) to also skip rendering the `suggestedFor` dot on those cards.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Refine attribution prompt in both locations (~line 1783 and ~line 8446) to exclude logistical and user-requested activities from single-traveler attribution |
| `src/components/itinerary/EditorialItinerary.tsx` | Skip rendering `suggestedFor` badge when the activity type is logistical (hotel, airport, transfer, check-in, etc.) |

## Expected Result

- Hotel check-in → no dot (or "group" dot if shown at all)
- Airport arrival → no dot
- US Open (user-requested must-do) → both travelers' dot, consistently across all days
- AI-picked rooftop bar → single traveler dot based on whose DNA drove the pick
- AI-picked brunch spot → appropriate traveler attribution

