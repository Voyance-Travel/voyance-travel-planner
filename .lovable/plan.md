## The bug

Musée de l'Orangerie shows $0 in the itinerary even though entry is €13/pp. Root cause: the venue isn't in `KNOWN_TICKETED_ATTRACTIONS` in `supabase/functions/generate-itinerary/sanitization.ts`. The list has Louvre, Orsay, Eiffel, Versailles, Sainte-Chapelle, Arc de Triomphe — but not Orangerie, Pompidou, Picasso, Rodin, Cluny, Panthéon, Opéra Garnier, Conciergerie, or the Catacombs.

When the model emits "Visit Musée de l'Orangerie" with cost $0, repair has no minimum-price floor to lift it. The generic "museum" regex in `ALWAYS_FREE_VENUE_PATTERNS` is *excluded* (line 57 — museums are explicitly NOT free), but without an entry in the ticketed map there's no floor enforcement.

## Plan

Extend `KNOWN_TICKETED_ATTRACTIONS` in `sanitization.ts` with the major Paris paid museums/monuments missing today, using current published adult admission prices (USD-equivalent):

| Venue | Floor |
|---|---|
| Musée de l'Orangerie | $13 |
| Centre Pompidou | $15 |
| Musée Picasso | $14 |
| Musée Rodin | $13 |
| Musée de Cluny | $12 |
| Panthéon | $11 |
| Opéra/Palais Garnier | $14 |
| Conciergerie | $11 |
| Catacombs of Paris | $29 |
| Orsay Museum (English alias) | $14 |

Each adds both accented and unaccented spellings (e.g. `musée de l'orangerie`, `musee de l orangerie`, plain `orangerie`) so the existing matching loop in `enforceTicketedAttractionPricing` and `action-repair-costs.ts` catches them regardless of how the model writes the name.

No schema or trigger changes needed — the existing repair pipeline already promotes any $0 row that matches a key in this map to its minimum price (source = `ticketed_attraction_floor`, exempt from the 3× cap after this morning's migration).

## Files touched

- `supabase/functions/generate-itinerary/sanitization.ts` — extend `KNOWN_TICKETED_ATTRACTIONS` with the Paris venues above

## Effect on the live trip

After approval, hitting "Repair costs" on the open Paris trip (or regenerating any day containing the Orangerie) will lift its $0 to $13/pp ($26 for 2 travelers). This will also apply to any future trip that books these venues.

## Out of scope

- Other cities — happy to add a similar pass for Rome, Tokyo, NYC, etc. in a follow-up if you want a sweep across the catalog. This fix is Paris-only because that's the trip currently surfacing the bug.

Approve to apply.