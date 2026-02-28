

# Fix: Only Generate 2 Free Days for First Trip (Not All Days)

## Problem
When a first-trip user creates a 7-day trip, the system generates ALL 7 days of AI content even though only 2 are free. The remaining 5 days are generated but locked behind a paywall -- meaning we pay for AI generation that may never be viewed. This is a significant margin issue.

## Root Cause
In `src/hooks/useGenerationGate.ts`, line 127:
```typescript
generateDays: params.days, // Generate ALL days; premium content gated via entitlements
```

For first trips, the gate returns ALL requested days as `generateDays`. The ItineraryGenerator then generates all of them via the AI, even though only the first 2 are free.

## The Fix
One line change: cap `generateDays` to **2** for first-trip users instead of generating all days.

### File: `src/hooks/useGenerationGate.ts`

Change line 127 from:
```typescript
generateDays: params.days, // Generate ALL days; premium content gated via entitlements
```
to:
```typescript
generateDays: 2, // Only generate 2 free days; remaining days generated on-demand when user pays
```

## Why This Is Safe
The existing unlock infrastructure already handles on-demand generation:
- `useUnlockDay.ts` calls `generate-itinerary` with `action: 'generate-day'` to generate a single day when the user pays credits
- `useBulkUnlock.ts` handles unlocking multiple days at once
- `ItineraryGenerator.tsx` (lines 306-327) already creates locked placeholder days for any days beyond `generateDays` and appends them to the itinerary
- `LockedDayCard.tsx` shows the unlock UI with "Plan this day for me" and "I'll do it myself" options

No other files need changes -- the entire downstream flow (placeholder creation, unlock UI, on-demand generation) already works correctly when `generateDays < requestedDays`.

## Impact
- First-trip cost drops from ~7x AI generation to 2x (for a 7-day trip, that's ~71% cost reduction)
- User experience unchanged: they see 2 fully generated days + locked cards for the rest, with clear unlock CTAs

