## Plan

1. **Make pre-dawn stripping authoritative everywhere**
   - Update the shared pre-dawn hotel stripper so it removes any hotel-return/accommodation ghost anywhere in a day, not only while it is the first activity.
   - Treat both `startTime` and fallback `time` fields as suspect, and normalize conflicting `start_time`/`startTime` values before save.

2. **Apply the stripper before every persistence path**
   - Run the shared cleanup in `persist-day` before writing `itinerary_days` / `itinerary_activities`.
   - Run it in the final `generate-trip-day` JSON write path immediately before `trips.itinerary_data` is saved.
   - Run it in `sync-itinerary-tables` so normalized rows cannot be rebuilt from stale JSON ghosts.

3. **Fix the wrong hotel/address source**
   - Make generated hotel-return cards use the resolved actual hotel name/address when available, never `Your Hotel` as a searchable venue.
   - Skip Google/place enrichment for hotel logistics even if a card is categorized as `STAY` rather than `accommodation`, so `Return to Your Hotel` cannot resolve to unrelated Venice hotels like Rio Terà Lista di Spagna.
   - Extend the hotel address consistency pass to cover `STAY` category and `venue_name: Your Hotel` fallback cases.

4. **Repair existing corrupted Venice data**
   - Remove the two Day 1 pre-dawn hotel-return ghost cards from `trips.itinerary_data` for the affected trip.
   - Re-sync/clean the normalized itinerary tables for that trip so the preview and reload state agree.

5. **Add regression coverage**
   - Add tests for mixed `startTime`/`start_time` ghost rows, non-leading pre-dawn hotel returns, `STAY` category returns, and hotel logistics not being enriched as a real searchable venue.