

# Remove System Locks from Hotel and Transport Activities

## Problem
When hotel or transport data is added or shared, the system automatically locks those activities so nobody can edit them. Users should be able to change everything -- locking should only happen when a user explicitly chooses to lock something.

## Changes

### 1. Remove locks from cascade-generated transport blocks
**File:** `src/services/cascadeTransportToItinerary.ts`

Two transport blocks are created with `isLocked: true`:
- The "Head to station" departure block (line 137)
- The "Arrive & Check In" block (line 181)

Change both to `isLocked: false`.

### 2. Remove locks from sample itinerary data
**File:** `src/data/sampleItineraries.ts`

Approximately 20+ activities across sample itineraries have `isLocked: true`. Remove or set to `false` on all of them so sample/demo data doesn't come pre-locked either.

### 3. No changes needed
- `previewConverter.ts` — The `isLocked: true` there is for the premium day-gating paywall (locked vs unlocked days), not activity editing locks. This is a different system and should stay.
- `EditorialItinerary.tsx` — The synthetic travel cards (`mkActivity`) were already fixed to `isLocked: false` in a previous change.

## Summary
| File | Change |
|------|--------|
| `src/services/cascadeTransportToItinerary.ts` | Set `isLocked: false` on departure and arrival blocks |
| `src/data/sampleItineraries.ts` | Set all `isLocked: true` to `false` across sample data |

