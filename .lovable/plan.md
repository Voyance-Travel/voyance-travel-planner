

# Fix: `.toLowerCase()` crash in TransitBadge

## Root cause identified

The persistent crash is in `src/components/itinerary/TransitBadge.tsx`, **not** in `EditorialItinerary.tsx`. Lines 74-75 call `transportation.method.toLowerCase()` without a null guard:

```typescript
const icon = transportIcons[transportation.method.toLowerCase()] || ...;
const currentMode = transportation.method.toLowerCase();
```

When the edge function request is interrupted (as the logs show: "Server request interrupted — likely network disconnect"), the last day's data may be saved with incomplete `transportation` objects where `method` is `undefined`. Every re-render of any activity with such a `transportation` object triggers this crash.

This explains why:
- It crashes on the **last day** (network interruption during generation)
- Previous fixes to `EditorialItinerary.tsx` didn't help (the crash is in a separate file)
- The crash fires repeatedly (React retries rendering in the error boundary loop)

## Changes

### 1. Guard `TransitBadge.tsx` (the actual crash site)
- Line 74: `transportation.method.toLowerCase()` → `(transportation.method || 'walk').toLowerCase()`
- Line 75: same guard
- Line 34: `currency.toUpperCase()` → `(currency || 'USD').toUpperCase()`

### 2. Guard the `transportation` prop in `EditorialItinerary.tsx`
- Where `TransitBadge` is rendered (line ~10660), add a guard: only render if `transportation.method` is truthy. This prevents passing malformed transportation objects entirely.

## Files to modify
- `src/components/itinerary/TransitBadge.tsx` — guard 2 bare `.toLowerCase()` and 1 `.toUpperCase()`
- `src/components/itinerary/EditorialItinerary.tsx` — add `transportation.method` guard before rendering TransitBadge

