

## Fix: Suggestion deadline not displayed after setting it

### Root cause

After `handleUpdateDeadline` succeeds, two things happen nearly simultaneously:
1. **Optimistic update** — `setSuggestions` sets `vote_deadline` on the suggestion locally (line 321)
2. **Realtime reload** — the DB write triggers a `postgres_changes` event (line 138-143) which calls `loadSuggestions()`, re-fetching all suggestions from the database

The realtime reload fires within milliseconds. If it reads from a replica that hasn't synced the write yet, it overwrites the optimistic state with stale data (where `vote_deadline` is still null). The deadline briefly flashes then reverts to "Set deadline."

### Fix

**File: `src/components/suggestions/TripSuggestions.tsx`**

1. Add a `skipRealtimeUntil` ref that holds a timestamp
2. In `handleUpdateDeadline` (and `handleSubmit`), set `skipRealtimeUntil` to `Date.now() + 2000` (2-second suppression window)
3. In the realtime handler (line 143/148), check `if (Date.now() < skipRealtimeRef.current) return;` — skip the reload if we're within the suppression window
4. This lets the optimistic update persist. The next genuine realtime event (or manual refresh) will pick up the correct DB state.

```typescript
// Add ref
const skipRealtimeRef = useRef(0);

// In realtime handler
}, () => {
  if (Date.now() < skipRealtimeRef.current) return;
  loadSuggestions();
})

// In handleUpdateDeadline, after optimistic update
skipRealtimeRef.current = Date.now() + 2000;
```

### Scope
Single file: `src/components/suggestions/TripSuggestions.tsx` — ~6 lines added.

