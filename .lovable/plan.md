

## Post-Generation Itinerary Cleanup — Standalone Edge Function

### Approach
Create a new `cleanup-itinerary` edge function that reads saved itinerary days from the database, applies all text sanitization and structural fixes, and writes cleaned data back. The generation pipeline (`index.ts`) is **not touched**. If cleanup fails, the raw itinerary remains intact.

### Changes

**1. New edge function: `supabase/functions/cleanup-itinerary/index.ts`** (~200 lines)

- Accepts `{ tripId }`, loads trip metadata (destination, hotel_selection) and all `itinerary_days` rows
- For each day's activities, applies text cleaning:
  - Schema field leaks (`,type`, `,category`, etc.)
  - Booking urgency (`BOOK 2-4 WEEKS`, emoji flags)
  - System prefixes (`EDGE_ACTIVITY:`, `SIGNATURE_MEAL:`, etc.)
  - AI self-commentary ("This addresses the wellness interest")
  - Generic placeholder replacement ("the destination" → actual city name)
  - Boolean/code field leaks (`isVoyancePick: true`)
- Strips phantom hotel activities when no hotel is booked
- Removes cross-day venue duplicates (attractions only, meals exempt)
- Sorts activities chronologically by startTime (handles both 12h and 24h)
- Deduplicates tips === description
- Cleans day-level text fields (title, theme, narrative)
- Saves changed days back to `itinerary_days` table
- Returns `{ success, totalFixes, daysProcessed }`

**2. Register in `supabase/config.toml`**

Add `[functions.cleanup-itinerary]` with `verify_jwt = false`.

**3. Wire into poller's onReady — `src/hooks/useGenerationPoller.ts`**

At the points where the poller sets `status: 'ready'` and calls `onReady()` (lines 166-174, 186-195, 201-210, 219-228), add a fire-and-forget cleanup call:

```typescript
// After onReady fires, trigger background cleanup
supabase.functions.invoke('cleanup-itinerary', { body: { tripId } })
  .then(({ data, error }) => {
    if (error) console.warn('[cleanup] Post-generation cleanup failed (non-fatal):', error);
    else console.log('[cleanup] Itinerary cleaned:', data);
  });
```

This will be a small helper function `fireBackgroundCleanup(tripId)` called from each ready-transition branch. The tripId is already available via `tripIdRef`.

**4. No manual "Clean Up" button** — keeping it simple. The automatic fire-and-forget on ready is sufficient.

### What's NOT touched
- `supabase/functions/generate-itinerary/index.ts` — untouched
- `supabase/functions/generate-itinerary/sanitization.ts` — untouched
- Existing hooks, components, meal guard — untouched

### Files
| File | Change |
|------|--------|
| `supabase/functions/cleanup-itinerary/index.ts` | New file (~200 lines) |
| `supabase/config.toml` | Add cleanup-itinerary entry |
| `src/hooks/useGenerationPoller.ts` | Add background cleanup call on ready transitions |

### Deploy
Edge function auto-deploys. Frontend rebuilds with poller change.

