

## Consolidate Trip Intelligence Into One Unified Section

### Current State
- **Trip Overview** (lines 3915-4021 in EditorialItinerary): Collapsible section with flights, hotel, destination info, and travel intel cards — but `travelIntelCards` is never passed from TripDetail to EditorialItinerary (only to MobileTripOverview)
- **ItineraryValueHeader** (lines 4023-4031): Separate stats badges section below Trip Overview
- **Trip Summary** (lines 4046-4160+): Full card with pricing, actions, export, etc.
- **Desktop Travel Intel** (TripDetail lines 2171-2202): Standalone TravelIntelCard rendered outside EditorialItinerary

### Plan

#### 1. TripDetail.tsx — Pass `travelIntelCards` to EditorialItinerary + remove desktop standalone

**Pass prop**: Add `travelIntelCards={...}` to the `<EditorialItinerary>` component (around line 2277), using the same TravelIntelCard JSX currently at lines 2171-2202.

**Remove standalone desktop Travel Intel**: Delete lines 2171-2202 (the `{!isPastTripView && (...)}` block with TravelIntelCard inside the `hidden sm:block` div). Keep the TripHealthPanel.

#### 2. EditorialItinerary.tsx — Merge Trip Overview + ItineraryValueHeader into one "Voyance Intelligence" collapsible

**Replace lines 3915-4031** (Trip Overview collapsible + ItineraryValueHeader) with a single unified collapsible section:

- **Header row**: Sparkles icon + "Voyance Intelligence" title + collapsed summary (savings text) + chevron toggle
- **Expanded content**:
  - **Row 1**: Stats badges grid (Voyance Finds, Timing Hacks, Local Picks, Insider Tips) from `valueStats` — only if any > 0. Include savings summary line.
  - **Row 2**: Trip essentials grid (timezone, currency, language, emergency) from `destinationInfo`
  - **Row 3**: Travel Intel cards from `travelIntelCards` prop
  - **Row 4**: Flight/hotel info currently in Trip Overview (preserved from existing code)

**Keep Trip Summary card** (lines 4046+) — that's pricing/actions, not intelligence. It stays separate.

**Remove ItineraryValueHeader import** (line 111) since it's no longer used.

#### 3. No changes to
- TravelIntelCard component
- MobileTripOverview (keeps its own collapsed layout)
- Trip Summary card (pricing, export, share actions)
- Edge functions or database

### Technical Notes
- The `Collapsible` component from radix is already imported in EditorialItinerary
- `valueStats` is already computed in the component
- `travelIntelCards` prop already exists in interface and is destructured — just needs to be passed from TripDetail
- Icons (Sparkles, Clock, Target, TrendingUp) need to be verified as imported

