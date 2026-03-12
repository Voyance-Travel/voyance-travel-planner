

## Root Cause: Stale Edge Function Deployment

The deployed `generate-itinerary` edge function is **out of sync** with the source code in the repository.

**Evidence:**
- Edge function logs show `[schema-generation] Validation high: Slot count MISMATCH: AI returned 4 activities but 8 required slots expected` — the schema-driven path is running
- But searching the source code for `[schema-generation]`, `Slot count MISMATCH`, `auto-correction`, `compileDaySchema`, or `DaySchema` returns **zero matches** in `supabase/functions/generate-itinerary/`
- The `USE_STRICT_GENERATOR` flag in `src/config/environment.ts` was never wired to the edge function — it was dead code
- A previous deployment baked the schema generation code directly into the edge function, then subsequent edits cleaned the source but **never triggered a redeploy**

**Data proof:**
- Trip `3050fbc7` (generated today): **3-4 activities per day** — schema path producing sparse output
- Trip `a06877ff` (generated March 9, before schema code): **6-7 activities per day** — legacy path working correctly

**Why flipping the flag did nothing:** The flag only exists in the frontend config. The edge function has no conditional branch — the schema code runs unconditionally in the deployed version.

### Fix

**Redeploy the `generate-itinerary` edge function** from the current source code. The current source contains only the legacy generation path (no schema generation code). A fresh deploy will overwrite the stale deployed version and restore the working behavior.

This is a zero-code-change fix — the source is already correct, it just needs to be deployed.

### About the CORS error

The initial CORS error (`No 'Access-Control-Allow-Origin' header`) is a transient cold-start issue. The current CORS headers in the source are correct (lines 257-262). This will also be resolved by the redeploy.

