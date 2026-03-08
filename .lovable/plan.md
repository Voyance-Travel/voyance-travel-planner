

## Rename "Steps (est.)" → "Est. Walking" in Stats Components

Two files need a label change:

1. **`src/components/trips/ActiveTripStats.tsx`** (line 111): Change `'Steps (est.)'` → `'Est. Walking'`
2. **`src/components/post-trip/TripStats.tsx`** (line 69): Change `'Steps (est.)'` → `'Est. Walking'`

Both still show the same `Xk` value derived from estimated walking distances. No logic changes needed.

