## Problem

User sees **"Table du Quartier"** as the Day 3 lunch venue in Paris. It's a generic AI-invented French phrase, not a real restaurant — exactly the class of stub the **Meal Rules** core memory bans.

## Why it leaked

We already have full server-side detection for this (`AI_STUB_VENUE_PATTERNS` in `supabase/functions/generate-itinerary/fix-placeholders.ts`, line 446–453 — "Table du Quartier" is even an explicit example). The detection fires through three guards: `nuclearPlaceholderSweep`, `validate-day → checkGenericVenues`, and the dining filter in `action-generate-day` / `action-generate-trip-day`.

But none of those run on:

1. **Legacy itineraries** generated before the stub-pattern guards were added (the trip in question is a likely candidate — DB grep finds zero current rows containing "Table du Quartier", so it's almost certainly cached/persisted JSON in the user's browser session or a snapshot row).
2. **`refresh-day`** edge function — does its own AI call and never imports `matchesAIStubVenue` / `nuclearPlaceholderSweep`.
3. **`get-activity-alternatives`** — same: returns AI venues with no stub guard.
4. **Frontend rendering** — has no defensive check; whatever string the DB returns is displayed verbatim (the existing `sanitizeActivityName` only strips system prefixes / repairs orphan articles, not stub venues).

So once a stub is in the DB or arrives from refresh/alternatives, the user sees it.

## Fix

Three layered patches — all mirror the existing server pattern:

### 1. Frontend defensive rendering (covers all legacy data, instant)

Add a small utility `src/utils/stubVenueDetection.ts` that ports `AI_STUB_VENUE_PATTERNS` + `matchesAIStubVenue` to the client (no Deno deps). Then:

- In `sanitizeActivityName(name, opts?)`, accept an optional `{ category }` opt. When `category` is dining/restaurant/food **and** the (label-stripped) name matches a stub pattern, return the meal-aware fallback label `"Lunch — find a local spot"` (or Breakfast/Dinner/Drinks based on context the caller passes, defaulting to "Meal").
- Update the small set of high-traffic dining-card render sites to pass `{ category, mealType }`:
  - `EditorialItinerary.tsx` (the canonical day view — the surface the user is seeing)
  - `LiveActivityCard.tsx`, `BookableItemCard.tsx`, `ItinerarySummaryCard.tsx`, `CustomerDayCard.tsx`, `ItineraryEditor.tsx`
- Also detect when the *venue/location name* alone is a stub (title like `"Lunch"` + venue `"Table du Quartier"`); in that case mask the venue display to `"Find a local spot"` and tag the card with a "Suggest a venue" affordance (reuse the existing assistant CTA already wired into these cards).

### 2. Cover `refresh-day` and `get-activity-alternatives`

After the AI call returns activities, both edge functions must:

- Import `matchesAIStubVenue` from `../generate-itinerary/fix-placeholders.ts`.
- For any returned dining activity whose title or location name matches a stub, either:
  - Substitute from the city's `INLINE_FALLBACK_RESTAURANTS` pool when available, or
  - Fall back to the same `"<Meal> — find a local spot"` marker + `__needs_meal_swap = true` flag that `nuclearPlaceholderSweep` already uses.

### 3. Tests

Extend `supabase/functions/generate-itinerary/fix-placeholders.test.ts` with the title-with-meal-label cases ("Lunch at Table du Quartier") to lock in coverage, and add a Vitest suite for the new client utility covering: bare stub, meal-prefixed stub, real restaurant ("Le Comptoir du Relais"), curly-apostrophe variant.

## Out of scope

- Bulk DB rewrite of legacy persisted itineraries — the renderer guard covers all surfaces, so a migration is unnecessary risk for a cosmetic fix.
- New regex patterns beyond what's already in `AI_STUB_VENUE_PATTERNS` — the existing list catches "Table du Quartier" already; we're just propagating coverage to the surfaces that don't run it yet.
