

## Fix 23D: Transport & Arrival Activity Ordering

### Problem
`reorderActivitiesOptimally()` treats arrival/departure as flexible activities and reorders them by geographic proximity, causing nonsensical sequences (transport before landing).

### Current State
- `ActivityWithLocation` type has no `startTime` field — the reorder function only knows `id`, `title`, `coordinates`, `neighborhood`, `isLocked`, `timeSlot`, `category`
- The conversion at line 5928 maps from `StrictActivity` but doesn't pass `startTime`
- The function splits activities into `isLocked` vs `flexible` — arrivals/transports aren't locked, so they get reordered

### Changes

**File: `supabase/functions/generate-itinerary/geographic-coherence.ts`**

1. **Extend `ActivityWithLocation`** — add optional `startTime?: string` field

2. **Update `reorderActivitiesOptimally()`** (lines 640-678):
   - Before nearest-neighbor sort, categorize activities into: arrivals, departures, early transports, and truly flexible
   - Arrivals pin to the front (alongside locked), departures pin to the end
   - Remove any transport activity whose startTime is before the earliest arrival's startTime
   - Only run nearest-neighbor on the remaining flexible activities
   - Reassemble: `[...arrivals, ...firstTransport, ...reorderedFlexible, ...departures]`

3. **Add `enforceTemporalDependencies()` helper** — categorizes by title keywords (arrival/departure/transport) and enforces ordering
4. **Add `deduplicateTransports()` helper** — removes transports scheduled before the first arrival

5. **Update default export** to include new helpers

**File: `supabase/functions/generate-itinerary/index.ts`** (line ~5928)

- Pass `startTime` when converting to `ActivityWithLocation`:
```typescript
startTime: (act as any).startTime || act.timeSlot?.split('-')[0],
```

### Files (2)
- `supabase/functions/generate-itinerary/geographic-coherence.ts` — Add temporal enforcement + transport dedup
- `supabase/functions/generate-itinerary/index.ts` — Pass startTime to ActivityWithLocation conversion

