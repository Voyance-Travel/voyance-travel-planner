
Goal: address the phantom-pricing report with the correct scope based on the current codebase, not the outdated prompt assumptions.

What I found
- The backend free-venue constant already exists in `supabase/functions/generate-itinerary/sanitization.ts` and it already includes `miradouro`, `praça`, `praca`, `plaza`, `piazza`, `viewpoint`, `jardim`, etc.
- The backend check is already wired and running:
  - `sanitizeGeneratedDay()` calls `checkAndApplyFreeVenue(...)`
  - `generation-core.ts` uses `ALWAYS_FREE_VENUE_PATTERNS` when writing `activity_costs`
  - `action-repair-costs.ts` also uses the same shared pattern
- The prompt-layer rule also already exists in `pipeline/compile-prompt.ts` (“Parks, gardens, plazas, squares, viewpoints, miradouros... are FREE (€0)”).
- The previous frontend fix also appears to already be present:
  - `src/lib/cost-estimation.ts` checks paid overrides against the title only
  - `src/components/itinerary/EditorialItinerary.tsx` no longer has `sightseeing` in `NEVER_FREE_CATEGORIES`

Conclusion
- This specific “ALWAYS_FREE_VENUE_PATTERNS is not running” theory is no longer supported by the current code.
- The next implementation should be a regression-hardening pass plus consistency fixes for all UI surfaces that can still estimate payable items from zero-cost activities.

Plan
1. Add focused regression tests for free public venue detection
- Add edge-function tests around `checkAndApplyFreeVenue` / sanitization behavior for:
  - Miradouro in title
  - Miradouro in venue only
  - Praça in title
  - Jardim free case
  - Museum / guided tour / booking-required exclusion
- Add frontend unit tests for `isLikelyFreePublicVenue()` covering the same cases, especially descriptions mentioning nearby “castle” or “palace”.

2. Add regression tests for UI cost rendering
- Add tests around the itinerary cost-resolution path so activities with explicit backend `cost.amount = 0` or `is_free = true` render as Free for miradouros/praças/jardins.
- Cover the fallback case where description contains paid-landmark words but title/venue is a free public space.

3. Audit and align all pricing surfaces
- Review every place using `estimateCostSync` / payable-item inference so the same free-venue logic is consistently honored.
- Priority files:
  - `src/components/itinerary/EditorialItinerary.tsx`
  - `src/hooks/usePayableItems.ts`
  - any other itinerary/payment summaries that still estimate from zero values
- If one surface still treats broad categories like `activity`/`cultural` as “never free,” narrow that logic so explicit free public venues win first.

4. Preserve backend authority explicitly
- Ensure all frontend pricing surfaces prioritize, in order:
  - `is_free === true`
  - explicit `cost.amount === 0`
  - normalized root-level zero price fields
  - free-public-venue detector
  - only then estimation fallback
- This prevents future regressions even if categories are broad like `EXPLORE` / `activity`.

5. Verify with the reported Lisbon cases
- Use the reported examples as permanent regression fixtures:
  - “Scenic Views at Miradouro de São Pedro de Alcântara”
  - “Golden Hour at the Miradouro”
  - “Sunset Views at the Miradouro”
  - “Praça do Comércio”
  - Jardim free case
  - paid museum/tour counterexamples
- Success condition: all free public spaces stay Free across itinerary cards and payment/payable views.

Technical details
- Backend file already handling free venues:
  - `supabase/functions/generate-itinerary/sanitization.ts`
- Backend call sites already using it:
  - `supabase/functions/generate-itinerary/sanitization.ts`
  - `supabase/functions/generate-itinerary/generation-core.ts`
  - `supabase/functions/generate-itinerary/action-repair-costs.ts`
- Frontend files to harden:
  - `src/lib/cost-estimation.ts`
  - `src/components/itinerary/EditorialItinerary.tsx`
  - `src/hooks/usePayableItems.ts`

Why this plan
- Re-implementing the old prompt verbatim would duplicate logic that already exists.
- The safer fix now is to lock the behavior down with tests and remove any remaining UI/payment inconsistencies that can still surface phantom prices even when backend data is already zero/free.
