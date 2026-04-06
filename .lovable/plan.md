

## Fix Generic Venue Repair Fallback — Use Real Restaurant Names When Pool Is Exhausted

### Root Cause

The detection works — `validate-day.ts` line 39 correctly catches "Lunch at a bistro" as `GENERIC_VENUE`. The repair in `repair-day.ts` lines 300-327 tries to replace it from `restaurantPool`, but when the pool is exhausted (all matching venues already used), the fallback (lines 329-344) only cleans the location field — it leaves the generic title "Lunch at a bistro" intact.

The fix: when the pool has no replacement, use a hardcoded city-aware fallback restaurant list to assign a real restaurant name instead of leaving the placeholder.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (lines 329-344)

Replace the "no pool venue available" fallback block with logic that:

1. Defines a `FALLBACK_RESTAURANTS` map keyed by city (starting with Lisbon, expandable), with entries per meal type — each entry has `name`, `neighborhood`, and `address`
2. When no pool replacement is found, looks up `resolvedDestination` in the fallback map
3. Picks a restaurant for the detected meal type that isn't in `usedSet`
4. Rewrites `act.title` to "Lunch at [Real Name]", `act.location.name` to the real name, and `act.location.address` to the real address
5. If even the fallback list is exhausted, falls back to the existing behavior (clean location only) but also rewrites the title to remove the generic article pattern (e.g., "Lunch at a bistro" → "Lunch")

Example fallback restaurants for Lisbon:
- **Breakfast**: Heim Café, Copenhagen Coffee Lab, Hello Kristof, The Mill, Nicolau Lisboa
- **Lunch**: Cervejaria Ramiro, Ponto Final, O Velho Eurico, A Cevicheria, Café de São Bento
- **Dinner**: Sacramento do Chiado, Solar dos Presuntos, Sea Me, Mini Bar Teatro, Pharmácia

### Files to edit
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add city-aware fallback restaurant list for when the pool is exhausted, ensuring generic titles are always replaced with real restaurant names

### Verification
Generate a 4-day Lisbon trip. Every dining activity should have a real restaurant name. Check logs for `[Repair] GENERIC_VENUE` entries — if the fallback fires, it should show "Replaced ... → Lunch at [Real Name]" instead of "No pool replacement".

