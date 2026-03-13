

## Fix: Multi-City Days Disappearing After Page Refresh

### Root Cause (Confirmed with DB Evidence)

The database shows clear evidence of the bug:
- **Mallorca leg**: `itinerary_data.days` has **2 days**, but `itinerary_days` table has **4 rows**
- **Madrid leg**: `itinerary_data.days` has **5 days**, but `itinerary_days` table has **7 rows**

The `itinerary_data` JSONB (what the frontend reads for display) was truncated by a partial/early save during the generation chain, but the `itinerary_days` table (where days are saved individually) has the complete set. No existing code path reconciles this mismatch — the self-heal logic sees `max(json_days, table_days) >= expected` and considers the trip "ready," but the UI renders from the truncated `itinerary_data.days`.

### Fix Plan (3 changes)

**Change 1 — Server-side no-shrink guard in `save-itinerary` action**
File: `supabase/functions/generate-itinerary/index.ts` (~line 9630)

Before writing `itinerary_data`, read the current day count from both `itinerary_data.days` and `itinerary_days` table. If the incoming day count is smaller than the canonical existing count, block the write (log a warning and return success without updating) unless the request explicitly includes `allowShrink: true`. This prevents any client or server path from accidentally truncating a complete itinerary.

**Change 2 — Frontend self-heal: rebuild `itinerary_data` from `itinerary_days` on load**
File: `src/pages/TripDetail.tsx` (~line 911, inside the self-heal block)

When the trip is `ready` and `itinerary_data.days.length < itinerary_days count`:
1. Fetch full `itinerary_days` rows with activities
2. Rebuild the `itinerary_data.days` array from the `itinerary_days` table data
3. Merge any enrichment metadata (photos, coordinates, etc.) from the existing truncated days
4. Persist the healed `itinerary_data` back to the DB (only when the rebuilt version is larger)
5. Update local state so the UI immediately shows all days

This makes already-corrupted trips self-recover on next page load.

**Change 3 — Server-side no-shrink guard in `generate-trip-day` chain save**
File: `supabase/functions/generate-itinerary/index.ts` (~line 10900)

In the `generate-trip-day` accumulation logic, after deduplication, add a guard: if `updatedDays.length < existingDays.length`, log an error and use `existingDays` as the base (keeping the larger set). This prevents the chain from accidentally shrinking during deduplication edge cases.

### Immediate Data Fix

For the already-affected trips (Mallorca with 2/4, Madrid with 5/7), the frontend self-heal in Change 2 will automatically repair them on next page load by pulling the full day data from `itinerary_days`.

### Technical Details

The truncation happens because `generate-trip-day` reads `existingDays` from `itinerary_data` at line 10671, but if a previous chain step's save was interrupted or raced with another write, `itinerary_data.days` can be shorter than the `itinerary_days` table. Subsequent chain steps then build on the truncated base, cementing the data loss.

The no-shrink guard (Change 1) is the primary fix — it prevents truncation at the write layer. The self-heal (Change 2) recovers existing corrupted data. The chain guard (Change 3) prevents the deduplication logic from ever producing fewer days than it started with.

