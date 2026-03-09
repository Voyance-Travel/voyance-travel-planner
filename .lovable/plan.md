

## Fix: Switch TransitModePicker from `transfer-pricing` to `airport-transfers` + Add Walk Option + Two-Level Expansion

### Problem
The `TransitModePicker` currently calls `transfer-pricing`, which returns sparse results for in-city routes (no route descriptions, no pros/cons, no booking tips). The `airport-transfers` function returns richer data (route, pros, cons, trainLine, bookingTip) and has Google Maps live duration lookups. Walking is also missing.

### Changes

**File: `src/components/itinerary/TransitModePicker.tsx`** — Full rewrite of data layer and UI

1. **Switch edge function** (line 137): Change `'transfer-pricing'` → `'airport-transfers'` with matching request body:
   ```ts
   const { data, error } = await supabase.functions.invoke('airport-transfers', {
     body: {
       origin: transitOrigin,
       destination: activity.location?.name || transitDestination,
       city,
     },
   });
   ```

2. **Update `TransportOptionData` interface** to match `airport-transfers` response shape:
   - `label` (not `title`), `estimatedCost` (not `priceFormatted`/`priceTotal`), `icon` (emoji), `route`, `pros`, `cons`, `bookingTip`, `costPerPerson`
   - Remove `distance`, `isBookable`, `bookingUrl`, `source`, `confidence`

3. **Remove `GoogleMapsData` state and display** — `airport-transfers` doesn't return a separate `googleMapsData` block (its durations are embedded in each option).

4. **Add Walk option client-side** after fetching, for non-airport routes:
   ```ts
   if (!isAirportRoute) {
     options.push({ id: 'walk', mode: 'walk', label: 'Walk', icon: '🚶', duration: 'Varies', durationMinutes: 0, estimatedCost: 'Free', route: `Walk to ${transitDestination}`, pros: ['Free', 'See the neighborhood', 'Good for short distances'], cons: ['Weather dependent', 'Not practical for long distances'], notes: 'Best for distances under 20 minutes' });
   }
   ```

5. **Filter airport-specific options** for non-airport routes: remove `hotel_car`, rename "Airport Bus / Shuttle" → "Bus / Shuttle".

6. **Add two-level expansion UI**:
   - **Level 1**: Options list (icon + label + duration + cost) — shown when row is tapped
   - **Level 2**: Tap an option card → expand to show `route`, `trainLine`, `pros` (green ThumbsUp), `cons` (amber ThumbsDown), `notes`, `bookingTip`, and "Switch to X" button
   - Track `expandedOptionId` state for Level 2

7. **Update `handleSelectOption`**: Parse cost from `estimatedCost` string (regex `replace(/[^0-9.]/g, '')`) instead of using `priceTotal`. Build title as before.

8. **Show `aiRecommendation`** from response at top of options panel.

9. **Remove `travelers` and `transitOrigin` from props interface** — `airport-transfers` doesn't use travelers count; origin is passed from existing prop but body shape changes.

Actually, keep `transitOrigin` — it's used as the `origin` in the request body. Remove `travelers` from the required prop since `airport-transfers` accepts `travelers` optionally.

**File: `src/components/itinerary/EditorialItinerary.tsx`** — No changes needed (the component call at line 8551 already passes all required props; `travelers` is already passed and will still work as optional).

