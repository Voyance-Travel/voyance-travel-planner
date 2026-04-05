
Fix Phantom Pricing v6 — corrected implementation plan

Root cause
- This is not primarily a `sanitizeGeneratedDay` failure.
- I checked trip `09efb45d-e277-4aa7-9b4e-e81168771bed`, and the saved itinerary already has `cost.amount = 0` / `estimatedCost.amount = 0` for the reported free venues (Praça do Comércio, Jardim das Amoreiras, Miradouro-related entries).
- The visible `~€23` is being reintroduced on the client by fallback estimation in:
  - `src/components/itinerary/EditorialItinerary.tsx`
  - `src/hooks/usePayableItems.ts`
- Why it happens:
  - generic categories like `activity` / `sightseeing` are treated as “never free”
  - the current free-venue detection is too narrow and mostly title-only
  - Portuguese/public-space terms like `praça`, `miradouro`, `jardim`, plus similar free outdoor venue patterns, are not covered well enough before estimation runs

Implementation
1. Add a shared free-public-venue detector in an existing pricing file
- Use `src/lib/cost-estimation.ts` (no new file).
- Add a helper that checks combined text from title + location name + address + description.
- Match public/free venue patterns such as:
  - `praça` / `praca`, `square`, `plaza`
  - `miradouro`, `viewpoint`, `lookout`
  - `jardim`, `garden`, `park`
  - `waterfront`, `riverside`, `promenade`
  - `walk`, `stroll`, `district`, `neighborhood`
- Exclude clearly paid cases:
  - dining / bars
  - museums / admissions / tickets
  - spa / wellness
  - airport / taxi / transfer / rideshare

2. Update `src/components/itinerary/EditorialItinerary.tsx`
- Use the shared helper before the “never free” estimation fallback.
- Pass combined venue text, not just the title.
- Result: zero-cost public venues render as `Free`, not `~€…`.

3. Update `src/hooks/usePayableItems.ts`
- Use the same helper before estimating zero-cost activities.
- Prevent free parks/plazas/viewpoints/gardens from becoming payable items or inflating payment totals.

4. Optional prompt reinforcement
- Add a short pricing reminder in `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`:
  - public outdoor spaces are free
  - do not guess default prices for them
- This is optional prevention, not the primary fix.
- I would not implement the proposed “scan all price fields in `sanitizeGeneratedDay` and target €18–28” as the main fix, because the reported venues are already saved as `0` in the itinerary data.

Files to edit
- `src/lib/cost-estimation.ts`
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/hooks/usePayableItems.ts`
- optional: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

Verification
- Reopen trip `09efb45d-e277-4aa7-9b4e-e81168771bed` and confirm:
  - Praça do Comércio shows `Free`
  - Jardim das Amoreiras shows `Free`
  - Miradouro de São Pedro de Alcântara shows `Free`
- Confirm Budget/Payments do not create payable entries for those free venues.
- Confirm legitimate priced items still keep prices:
  - dining
  - museum/ticketed attractions
  - wellness/spa
  - airport transfer / rideshare

Technical note
- `activity_costs` skips zero-value rows, so the UI must not re-estimate obviously free venues from generic categories after the backend has already zeroed them.
