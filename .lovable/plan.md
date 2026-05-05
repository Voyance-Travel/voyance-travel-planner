# High-Cost Wellness Activities: Booking Guidance Fix

## Problem

A $293 "Biologique Recherche" wellness treatment renders with no description, no booking flag, and no booking link. Root cause is two-fold:

1. **Misclassification** (`src/components/booking/InlineBookingActions.tsx`): the keyword list `HOTEL_AMENITY_KEYWORDS` includes generic words like `wellness`, `treatment`, `massage`, `spa`, `relaxation`. Any standalone wellness venue (Biologique Recherche, Aire Ancient Baths, etc.) gets flagged as a "hotel amenity" → `linkType === 'view_details'`, and because there's no `website`/`bookingUrl` → the component returns `null`. No link, no concierge prompt, nothing.
2. **No high-cost guard** during generation: the sanitizer/repair pass enforces booking guidance for dining + Viator-bookable items but never checks "this single experience costs more than X — does it have description + booking guidance?"

Result: the most expensive item on Day 3 looks less actionable than a $33 museum entry.

## Fix

### 1. Reclassify wellness venues (UI)

In `src/components/booking/InlineBookingActions.tsx`:

- Split `HOTEL_AMENITY_KEYWORDS` into two groups:
  - `STRONG_HOTEL_SIGNALS` (definitely hotel-bound): `at the hotel`, `hotel spa`, `hotel bar`, `hotel pool`, `lobby`, `rooftop bar at`, plus the existing branded chains (St Regis, Ritz, Four Seasons, etc.).
  - `AMENITY_KEYWORDS` (ambiguous on their own): `spa`, `wellness`, `treatment`, `massage`, `relaxation`, `pool`, `gym`, `sauna`, `lounge`.
- Update `isHotelAmenityActivity` to return `true` only when:
  - category is explicitly `accommodation` / `hotel` / `lodging` / `resort`, OR
  - title contains a `STRONG_HOTEL_SIGNAL`, OR
  - title contains an `AMENITY_KEYWORD` **and** also contains a hotel cue (`hotel`, `resort`, branded chain).
- Drop `spa` and `wellness` from `ACCOMMODATION_CATEGORIES` (those are legit standalone activity categories in the rest of the app: see `EditorialItinerary.tsx`, `ActivityModal.tsx`, `ActivityAlternativesDrawer.tsx` which all treat wellness as a first-class activity type).

### 2. High-cost guarantee (UI safety net)

Still in `InlineBookingActions.tsx`:

- Add `HIGH_COST_USD = 150`.
- In the `!activity.bookingRequired` branch, if `price >= HIGH_COST_USD` and `linkType` would otherwise be `'none'` or `'view_details'` without a URL:
  - Render a small "Booking guidance" cluster: a `RestaurantLink`-style search button ("Find on official site") that opens `https://www.google.com/search?q={encodeURIComponent(activity.title + ' ' + destination + ' booking')}` plus an "Ask concierge" button wired to `onAskConcierge` with a prefilled prompt ("How do I book {title}? It's listed at ${price}.").
- This guarantees no premium item ever renders as a dead-end.

### 3. Generation-side enforcement

In `supabase/functions/generate-itinerary/sanitization.ts` (existing `bookingRequired && currentPrice === 0` block already proves this pattern):

- Add a post-pass: for any activity where `(quoted price OR estimated cost) >= 150` AND category in `['wellness','spa','experience','tour','class','workshop','show','performance']`:
  - Force `booking_required = true`.
  - If `description` is empty/very short (< 60 chars), enqueue a fallback line: `"Premium ${category} experience — reservations are typically required well in advance. Use the official site or our concierge to confirm availability."`
  - Tag the activity with `metadata.booking_guidance_required = true` so the UI can show a stronger CTA.

### 4. Card surface

In `src/components/itinerary/EditorialItinerary.tsx` (or whichever card renders the activity row — confirm via the activity-render path), if `metadata.booking_guidance_required === true` and there's no description block today, render a one-line italic helper: *"High-value experience — confirm booking before you go."*

## Technical notes

- `HIGH_COST_USD` lives next to existing constants in `InlineBookingActions.tsx`; pulled from cost-reference if we want a tier later.
- The sanitizer change is idempotent (only fires when fields are missing) and respects the universal locking protocol — locked / user-edited activities are skipped via the existing `isLocked`/`metadata.user_edited` checks already used in that file.
- No DB migration needed; `metadata` is already a JSON column on activities.
- No memory updates required — this refines existing rules in `mem://constraints/itinerary/believable-human-pacing-principle` and `mem://features/booking/booking-cta-priority` rather than introducing new ones.

## Files to change

- `src/components/booking/InlineBookingActions.tsx` (reclassification + high-cost safety net)
- `supabase/functions/generate-itinerary/sanitization.ts` (high-cost description + booking_required guard)
- `src/components/itinerary/EditorialItinerary.tsx` (one-line helper when guidance flag set)

Approve to implement.