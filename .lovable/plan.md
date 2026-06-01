## What's happening

The console error is **not** blocking generation. I checked the trip in the DB:

- `e5eb9348-ceac-4d61-ae8e-27b4a741624f` → `itinerary_status: ready`, 4/4 days generated, zero failed days.

The CORS error you're seeing comes from a different edge function: **`backfill-must-do-anchor-enrichment`**. It's a lazy post-mount cleanup helper (fills addresses/descriptions on injected must-do anchor cards). Source exists in `supabase/functions/backfill-must-do-anchor-enrichment/index.ts` with proper CORS handling, but the function was **never deployed** — `curl` returns `404 NOT_FOUND` and edge logs are empty. Browsers surface a 404 on a preflight as a "CORS policy" error, which is misleading.

So the user-visible problem is one noisy console error on TripDetail mount; the underlying trip is fine.

## Fix

1. **Deploy `backfill-must-do-anchor-enrichment`.** One-shot deploy of the existing source — no code change. After this, the lazy mount call will return 200, stamp `metadata.must_do_enrichment_backfilled_at`, and never re-fire for that trip.

2. **Harden the caller in `TripDetail.tsx`** so a future missing-function / network blip never surfaces as a red console line: wrap the `supabase.functions.invoke('backfill-must-do-anchor-enrichment', …)` site in a quiet try/catch that routes through `classifyBackendError` + `console.warn` only (matches the Core "Backend Error Noise Policy" rule). This makes the contract honest: backfill is best-effort, never user-facing.

## Out of scope

- The earlier `spend-credits` / regenerate-day 403 work — already shipped and unrelated.
- `Flight sync failed` console line — separate path, the trip generated cleanly so no functional impact.
- The Day-4 transfer endTime cosmetic discrepancy from the prior pass.

## Technical notes

- No DB migration, no schema change.
- The function source already has the correct `corsHeaders` import + OPTIONS handler — deploy is sufficient.
- Frontend change is ~5 lines in the existing mount-effect that invokes the backfill.