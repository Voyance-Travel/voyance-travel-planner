## Plan: restore dining descriptions end-to-end

### What I found
- The canonical JSON in `trips.itinerary_data` for the latest Milan trip is missing all dining rows entirely, while `itinerary_activities` has the dining rows and most descriptions.
- The renderer is reading the degraded JSON path, so users see venue/location/price/link but no blurb for meals.
- The backend description filler exists, but it can still leave blanks when the LLM skips a row or when normalized table data is not reconciled back into `trips.itinerary_data`.

### Changes to implement
1. **Make save-time description filling deterministic**
   - Update the dining description helper so every dining card gets a non-empty, actionable description even if the AI fill fails.
   - Prefer sources in this order: existing valid description, inline fallback restaurant description, `personalization.whyThisFits`, venue-aware deterministic fallback.
   - Treat restaurant-link loading text separately; it should never be mistaken for description copy.

2. **Reconcile normalized dining rows back into the JSON itinerary**
   - In the itinerary save/generation path, before persisting `trips.itinerary_data`, merge missing dining activities/descriptions from `itinerary_activities` when the normalized table has fuller dining data for the same trip/day.
   - Preserve universal locking and avoid overwriting user-edited/manual rows.
   - Log a compact sentinel like `[DINING_JSON_RECONCILE] day=N inserted=X described=Y`.

3. **Harden frontend display fallback**
   - Add a shared dining-description resolver used by `EditorialItinerary` so dining cards display `description`, then `personalization.whyThisFits`, then a safe venue-aware fallback when data is still missing.
   - Ensure the fallback only applies to dining cards and does not alter saved data from the UI.

4. **Add regression coverage**
   - Add focused tests for:
     - blank dining description becomes an actionable fallback,
     - templated/generic dining text is replaced,
     - JSON itinerary dining rows are preserved/reconciled from normalized activities,
     - non-dining activities are not affected.

### Verification
- Run targeted tests for the new helpers.
- Query a recent Milan/Faro/Bruges/Bali trip shape to confirm dining rows/descriptions are present in the saved JSON after the save path.
- Check source greps for the new sentinel and shared resolver.