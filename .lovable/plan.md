

## Fix: Suggestion deadline doesn't update display after setting

### Root cause

In `src/components/suggestions/TripSuggestions.tsx`, `handleUpdateDeadline` (line 308) successfully updates the database but never updates the local `suggestions` state. The card continues rendering based on stale data where `vote_deadline` is null.

### Fix

**File: `src/components/suggestions/TripSuggestions.tsx`** — Add an optimistic state update inside `handleUpdateDeadline` after the successful DB write:

```typescript
// After line 314 (if (error) throw error):
setSuggestions(prev => prev.map(s =>
  s.id === suggestionId ? { ...s, vote_deadline: newDeadline } : s
));
```

This ensures the card immediately re-renders showing the deadline date instead of "Set deadline", and also correctly switches from the "add deadline" popover (line 582, `!suggestion.vote_deadline`) to the "edit/remove deadline" UI.

Single line addition — no other files affected.

