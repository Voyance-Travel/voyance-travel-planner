

## Fix 24T — Inter-City Transport as Compact Activity Cards

### Current State
- **Travel summary card** (transition day, line 8320-8327): Renders a dashed-border `div` with literal `...` as content — essentially empty/broken.
- **Departure card** (departure day, line 8329-8377): Renders a dashed-border card with icon, title, badge, and description lines — functional but visually heavy and not cohesive with the timeline.
- `activityStyles` (line 475-485): Missing transport-specific entries for inter-city modes.
- `LiveItineraryView.tsx` `TimelineActivityCard`: No special handling for inter-city transport.

### Changes

#### 1. `src/components/itinerary/EditorialItinerary.tsx` — Add transport-specific entries to `activityStyles` (line 475-485)

Add `transit`, `inter_city_flight`, `inter_city_train`, `inter_city_bus`, `inter_city_ferry`, `inter_city_car` entries with appropriate icons. `Bus` and `Ship` are already imported.

#### 2. `src/components/itinerary/EditorialItinerary.tsx` — Update synthetic travel card creation (line 1308-1339)

Replace the `travelCards` array to:
- Compute `interCityCategory` based on transport type (e.g., `inter_city_flight`)
- Set title to `"Flight to Paris"` instead of `"London → Paris"`
- Tag with `__interCityTransport: true` instead of `__syntheticTravelSummary`
- Include structured `__travelMeta` with carrier, times, cost, duration

#### 3. `src/components/itinerary/EditorialItinerary.tsx` — Update departure card creation (line 1375-1389)

Also tag departure cards with `__interCityTransport: true` and matching `interCityCategory` so both transition-day and departure-day cards render with the same compact UI.

#### 4. `src/components/itinerary/EditorialItinerary.tsx` — Replace both rendering blocks (lines 8306-8377)

Replace the old `isTravelSummary` block (empty `...` div) and the `isDepartureCard` block (dashed border) with a single unified compact transport strip renderer that handles both `__interCityTransport` and `__syntheticDeparture` cards:

- Single row: icon circle (28px) → title + carrier/duration subtitle → departure time → cost → expand chevron
- `bg-primary/[0.03]` with `border-primary/15` (subtle, not dashed)
- ~40px height — visually lighter than activity cards
- Tap-to-expand shows arrival time, seat class, booking ref
- Hidden in clean preview mode

#### 5. `src/components/itinerary/LiveItineraryView.tsx` — Compact transport in live view (line 114+)

At the top of `TimelineActivityCard`, detect `inter_city_*` category/type and return a compact strip instead of the full card. Import `Plane, Train, Bus, Ship, Car` from lucide-react.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Add transport entries to `activityStyles`; update travel card + departure card creation to use `__interCityTransport` + specific categories; replace both rendering blocks with unified compact strip |
| `src/components/itinerary/LiveItineraryView.tsx` | Add inter-city transport detection + compact strip rendering in `TimelineActivityCard`; add icon imports |

