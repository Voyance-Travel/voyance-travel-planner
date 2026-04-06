
Goal: make the “always free venue” rule explicit, shared, and guaranteed to run last in the active pricing flow.

What I found
- `ALWAYS_FREE_VENUE_PATTERNS` does not currently exist anywhere in the codebase.
- There is already free-venue logic in `supabase/functions/generate-itinerary/sanitization.ts`, but it is an inline local regex (`tier1FreePatterns`), not a shared named constant.
- Similar pricing logic is duplicated again in `action-repair-costs.ts` and `generation-core.ts`, so behavior can drift between paths.
- The active trip-generation chain (`action-generate-trip.ts` → `action-generate-trip-day.ts`) sanitizes day JSON, but it does not automatically rebuild canonical `activity_costs` at the end. `repair-trip-costs` is only triggered manually from the frontend after regeneration.
- Important verification note: `FREE VENUE CHECK` / `PHANTOM PRICING FIX` are server logs from the edge function, so checking the browser console alone can make it look like the rule never ran.

Implementation plan

1. Create a shared always-free matcher in `supabase/functions/generate-itinerary/sanitization.ts`
- Lift the existing Tier 1 regex into a named exported constant: `ALWAYS_FREE_VENUE_PATTERNS`.
- Keep the current pattern list unchanged.
- Add a small helper that checks both `title` and `venue_name`/`restaurant.name` (plus the existing text fields), applies the paid exclusions, and emits:
  - `FREE VENUE CHECK`
  - `PHANTOM PRICING FIX`
- Keep the existing Tier 2 logic and hotel/logistics zeroing intact.

2. Replace the inline sanitization check with the shared helper
- Update `sanitizeGeneratedDay(...)` to use the new shared matcher instead of the local `tier1FreePatterns`.
- Make the free-venue override operate on all supported price fields (`cost`, `estimatedCost`, `estimated_price_per_person`, `price`) exactly as today.
- Preserve the “don’t force-free booking/ticketed experiences” rule.

3. Reuse the same matcher in canonical pricing repair
- Update `supabase/functions/generate-itinerary/action-repair-costs.ts` to import/use the shared always-free matcher instead of its own separate Tier 1 regex.
- This keeps JSON activity pricing and `activity_costs` repair aligned for miradouros, jardins, plazas, etc.

4. Run canonical pricing repair at the end of the active generation chain
- Update `supabase/functions/generate-itinerary/action-generate-trip-day.ts` so that after final day completion and table sync, it also runs `handleRepairTripCosts` for the trip.
- This makes the always-free override the last pricing step in the active flow, preventing later cost writes from reintroducing phantom prices in `activity_costs`.

5. Backward-compatibility cleanup
- Review `supabase/functions/generate-itinerary/generation-core.ts` and replace its duplicated Tier 1 regex with the shared constant/helper as well, so older/fallback paths cannot diverge.

Technical details
- Files to edit:
  - `supabase/functions/generate-itinerary/sanitization.ts`
  - `supabase/functions/generate-itinerary/action-repair-costs.ts`
  - `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
  - `supabase/functions/generate-itinerary/generation-core.ts`
- No new files.
- No pattern-list expansion/removal.
- No changes to title sanitization.
- No force-free for `booking_required` or clearly paid experiences.

Verification
- Generate a fresh 4-day Lisbon trip.
- Confirm activities like “Scenic Views at Miradouro de São Pedro de Alcântara” and `Jardim` venues resolve to Free.
- Confirm museums, tours, galleries, and `booking_required` items keep prices.
- Check edge-function logs for:
  - `FREE VENUE CHECK`
  - `PHANTOM PRICING FIX`
- Confirm both the itinerary card pricing and canonical budget totals agree after generation completes.
