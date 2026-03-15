

# Fix: Clear "Just Tell Us" chat after trip creation

## Problem
The `TripChatPlanner` persists messages to `sessionStorage` (key `voyance_chat_messages`) but **never clears them**. After the user confirms a trip and navigates to `/trip/:id`, returning to `/start` reloads the entire old conversation — including stale "ready" confirmations and duplicate AI responses.

## Fix

**File: `src/pages/Start.tsx`** (~line 3125, in the `onChatDetailsExtracted` handler)

Before navigating to the trip page, clear the chat session:

```typescript
sessionStorage.removeItem('voyance_chat_messages');
navigate(`/trip/${trip.id}?generate=true`);
```

This needs to be added in **two places** within `Start.tsx`:
1. ~Line 3118 (multi-city split path)
2. ~Line 3127 (standard single-city path)

One-line addition in each path. The chat will start fresh on the next visit to `/start`.

