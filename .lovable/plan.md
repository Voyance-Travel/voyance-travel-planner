

# Fix: "Build It Myself" Trips Not Appearing

## Root Cause

The `parse-trip-input` edge function has **never been deployed**. When a user pastes their research in the "Build Myself" tab and clicks "Organize My Trip," the app calls `supabase.functions.invoke('parse-trip-input')`, which returns an error because the function doesn't exist on the server. The trip creation never completes, so no `manual_paste` trips exist in the database (confirmed: zero records with `creation_source='manual_paste'`).

## Fix

**Deploy the `parse-trip-input` edge function.** The code already exists at `supabase/functions/parse-trip-input/index.ts`. It just needs to be deployed so the "Build Myself" flow can actually parse user input and create trips.

### Steps

1. **Deploy `parse-trip-input`** — Use the edge function deployment tool to push the existing function code to production.

2. **Verify the function uses correct AI model** — The function likely calls an AI model to parse pasted text into structured trip data. Confirm it uses Lovable AI gateway or has the required API keys configured.

3. **Test end-to-end** — After deployment, verify:
   - Pasting text in "Build Myself" tab triggers parsing successfully
   - The parsed result shows in the review step
   - Confirming creates a trip in the database with `creation_source='manual_paste'`
   - The new trip appears on the My Trips dashboard

### Technical Details

- **File**: `supabase/functions/parse-trip-input/index.ts` (843 lines, already written)
- **Consumer**: `src/components/planner/ManualTripPasteEntry.tsx` line 89 — `supabase.functions.invoke('parse-trip-input')`
- **Trip creation**: `src/utils/createTripFromParsed.ts` — inserts with `creation_source: 'manual_paste'`
- **No code changes needed** — only deployment of the existing edge function
- **Dashboard display**: Already works — `TripDashboard.tsx` fetches all owned trips without filtering by `creation_source`

