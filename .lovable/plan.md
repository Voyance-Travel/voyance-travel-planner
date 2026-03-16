

## Upgrade Inter-City Transport from Compact Strips to Prominent Travel Cards

### The Problem

Currently, major travel events like "Flight to Paris" and "Train to Rome" render as tiny compact strips (~40px) — the same visual weight as a transit gap indicator. These are **core travel moments** and deserve a dedicated, visually distinct card treatment that matches their importance in the trip.

### Current State

- `InterCityTransportStrip` in `EditorialItinerary.tsx` (line 1138) renders a single-row strip with a small icon circle, title, and time
- `LiveItineraryView.tsx` (line 154) has its own minimal inter-city strip rendering
- Both departure cards (`__syntheticDeparture`) and arrival/transition cards (`__syntheticTravel`) use this same compact strip
- The data is already rich — `__travelMeta` carries carrier, flight number, departure/arrival times, duration, seat info, booking ref, and price

### The Plan

Replace the compact strip with a proper **Travel Card** component that visually signals "this is a major travel event." The card will:

1. **Full-width gradient banner** with transport-mode-specific color theming (blue for flights, green for trains, orange for buses, teal for ferries)
2. **Large transport icon** with the destination city name prominent
3. **Route visualization**: `City A → City B` with a dashed line between them
4. **Details row**: carrier + flight/train number, departure → arrival times, duration
5. **Expandable section** (existing behavior preserved): seat info, booking ref
6. **Distinct from standard activity cards** — uses a colored left border or top accent bar so it's immediately recognizable while scrolling

### File Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/InterCityTransportCard.tsx` | **New file** — standalone Travel Card component with transport-mode theming, route visualization, and expandable details |
| 2 | `src/components/itinerary/EditorialItinerary.tsx` | Replace `InterCityTransportStrip` usage (line 8591) with the new `InterCityTransportCard` |
| 3 | `src/components/itinerary/LiveItineraryView.tsx` | Replace the inline inter-city strip (lines 154-186) with the new `InterCityTransportCard` |

### Card Design

```text
┌─────────────────────────────────────────────────┐
│ ✈  FLIGHT TO PARIS                    Departs ▸ │
│     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─          14:30 │
│  Lisbon ·····························> Paris     │
│  TAP Air Portugal TP442 · 2h 45m                │
│                                           €89   │
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│  14:30 → 17:15  ·  Economy  ·  Ref: ABC123     │
└─────────────────────────────────────────────────┘
```

Transport-mode color accents:
- **Flight**: `bg-blue-500/10`, blue icon, blue left border
- **Train**: `bg-emerald-500/10`, green icon, green left border  
- **Bus**: `bg-amber-500/10`, orange icon, orange left border
- **Ferry**: `bg-teal-500/10`, teal icon, teal left border
- **Car**: `bg-slate-500/10`, gray icon, gray left border

### No Backend Changes

All data (`__travelMeta`) is already being injected correctly. This is purely a UI upgrade — the new card consumes the same props the strip currently receives.

