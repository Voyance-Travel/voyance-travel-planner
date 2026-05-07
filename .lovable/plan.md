# Fix: "Spa Time — find a venue" mislabel on Luggage Drop / Check-in cards at hotels named "...Resort & Spa"

## Root cause

The wellness placeholder detector matches on substring `\bspa\b` anywhere in the activity title. When the hotel is named e.g. "JW Marriott Venice Resort & Spa", any logistics card titled "Luggage Drop at JW Marriott Venice Resort & Spa" or "Check-in at JW Marriott Venice Resort & Spa" trips the detector. With no numeric address attached to that synthesized card, the detector returns true and the title is rewritten to the wellness fallback `"Spa Time — find a venue"`.

This is symmetric on both sides:

- **Server**: `supabase/functions/generate-itinerary/fix-placeholders.ts` → `isPlaceholderWellness()` (line ~495). Triggered by the wellness nuclear sweep / repair pass.
- **Client**: `src/utils/wellnessPlaceholderDetection.ts` → `isClientPlaceholderWellness()`. Triggered by every UI render via `sanitizeActivityName(..., { activity })` in `EditorialItinerary`, `TripActivityCard`, `LiveActivityCard`, `BookableItemCard`, etc.

The Rome occurrence the user mentioned was the same: any hotel with "Spa" in its branding (very common in Europe — Gritti Palace Spa, Six Senses, Mandarin Oriental Spa, etc.) hits this.

## Changes (two files + tests)

### 1. `src/utils/wellnessPlaceholderDetection.ts`
Add a hotel-logistics short-circuit at the top of `isClientPlaceholderWellness`. Return `false` immediately when:

- `category` is `accommodation` or `transport` / `transportation` / `transit`, OR
- `title` matches `/^(luggage[\s-]?drop|check[\s-]?in|check[\s-]?out|checkin|checkout|freshen[\s-]?up|return\s+to|drop\s+bags|bag[\s-]?drop|settle\s+in|hotel\s+arrival)\b/i`

These cards are never wellness — even if the venue name happens to contain "Spa".

### 2. `supabase/functions/generate-itinerary/fix-placeholders.ts`
Apply the identical short-circuit at the top of `isPlaceholderWellness()` so the server-side nuclear sweep doesn't downgrade these cards to `Spa Time at {hotel}` either.

### 3. Regression tests
Extend `src/utils/__tests__/wellnessPlaceholderDetection.test.ts` and `supabase/functions/generate-itinerary/fix-placeholders.test.ts` with cases:

- `Luggage Drop at JW Marriott Venice Resort & Spa` (category `accommodation`) → not flagged
- `Check-in at Gritti Palace Spa` → not flagged
- `Freshen up at Six Senses Spa` → not flagged
- Sanity: `Spa Time` (category `wellness`) still flagged
- Sanity: `Spa Valmont at Le Meurice` (allowlist) still passes through

## Verification

1. Deploy `generate-itinerary`.
2. Re-render the Venice trip preview without regenerating — the client-side fix alone should immediately restore the correct titles for Luggage Drop and Check-in.
3. Run unit tests: `bunx vitest run src/utils/__tests__/wellnessPlaceholderDetection.test.ts`.

## Out of scope

- No changes to wellness detection for genuine wellness/spa activities.
- No prompt or generation-pipeline changes — purely the placeholder-detection guard.
