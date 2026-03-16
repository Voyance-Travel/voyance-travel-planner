

# Fix: Guests Stuck in Preview Mode (Can't Propose Changes)

## Problem
When a guest (collaborator) opens a shared trip, they are forced into Preview mode and cannot propose changes. This happens because `useTripViewMode` only checks if the user is the trip **owner** (`user.id === trip.user_id`). Since collaborators are not owners, they get locked into preview mode, which hides all editing and proposal UI.

## Root Cause
- **`src/pages/TripDetail.tsx` line 158**: `isOwner = user.id === trip.user_id` — collaborators are always `false`
- **`src/hooks/useTripViewMode.ts` line 28**: `if (!isOwner) return 'preview'` — forces all non-owners into preview
- Preview mode sets `isCleanPreview = true` in `EditorialItinerary`, hiding all interactive controls (three-dot menus, propose buttons, etc.)

## Solution
Two small changes:

### 1. Update `useTripViewMode` hook
Add a `canEdit` option alongside `isOwner`. When `canEdit` is true (collaborator with edit permission), the user gets edit mode by default instead of being forced into preview. They still won't see owner-only controls (those are gated by `isOwner` separately), but they'll see the interactive itinerary with propose functionality.

### 2. Update `TripDetail.tsx`
Call the existing `get_trip_permission` RPC to determine if the current user is a collaborator with edit access, and pass that as `canEdit` to `useTripViewMode`. The RPC already exists and returns `{ isOwner, permission, canEdit }`.

This is a targeted fix: two files, no database changes needed.

