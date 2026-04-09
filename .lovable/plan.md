

# Fix: "trip is not defined" in Smart Finish Background Generation

## Root Cause

In `supabase/functions/enrich-manual-trip/index.ts`, the `runGenerationInBackground` function (line 162) references `trip.destination`, `trip.start_date`, etc. (lines 189-196) when building the request body for `generate-itinerary`. But `trip` is not passed as a parameter to this function — it only exists in the main `serve` handler scope (line 423). This causes a `ReferenceError: trip is not defined` at runtime, which gets stored in `metadata.smartFinishError` and surfaced to the user.

## Fix

**File: `supabase/functions/enrich-manual-trip/index.ts`**

Add a trip fetch at the start of `runGenerationInBackground`, before the `generate-itinerary` call:

```ts
async function runGenerationInBackground(
  supabaseUrl: string,
  supabaseServiceKey: string,
  authHeader: string,
  tripId: string,
  userId: string,
  updatedMetadata: any,
  pendingChargeId: string | null,
  baselineTripUpdatedAt?: string | null,
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[enrich-manual-trip:bg] Starting generate-itinerary for trip ${tripId}`);

    // Fetch trip data — needed for generate-itinerary request body
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city")
      .eq("id", tripId)
      .single();

    if (tripErr || !trip) {
      throw new Error(`Failed to fetch trip for background generation: ${tripErr?.message || 'not found'}`);
    }

    let generateData: any = null;
    // ... rest unchanged, trip.destination etc. now resolves correctly
```

This is a one-location fix — add a trip fetch query right after creating the supabase client in the background function, before the existing code references `trip.*` fields.

## Technical Details
- Single file change: `supabase/functions/enrich-manual-trip/index.ts`
- The `trip` variable was in the outer `serve` handler scope but closures don't capture it since `runGenerationInBackground` is called via `waitUntil` / fire-and-forget after the response is sent
- No schema changes needed

