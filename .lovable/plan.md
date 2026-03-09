

## Merge Voyance Intelligence + Trip Summary Into One Card

### Current State
Two separate cards in `EditorialItinerary.tsx`:
1. **Voyance Intelligence** (lines 3915-4098): Collapsible with stats badges, essentials, flights/hotel, travel intel
2. **Trip Summary** (lines 4113-4325): Separate card with trip total, currency toggle, action buttons (Share, Export PDF, Save, Optimize, Regenerate)

### Plan

**File: `src/components/itinerary/EditorialItinerary.tsx`**

**Replace lines 3915-4325** (both sections) with a single unified card containing four rows:

**ROW 1: Trip Total + Currency Toggle + Meta**
- Trip Total price with currency toggle button (from Trip Summary)
- Days/Guests/Credits info line

**ROW 2: Action Buttons**  
- Share, Export PDF, Save buttons (primary row)
- Optimize + Regenerate (desktop inline, mobile overflow menu)
- All logic preserved exactly from current Trip Summary

**ROW 3: Voyance Intelligence (collapsible)**
- Wrapped in `<Collapsible>` with Sparkles icon header
- Stats badges grid (Voyance Finds, Timing Hacks, Local Picks, Insider Tips)
- Savings summary line
- Collapsed state shows summary text

**ROW 4: Travel Intel (collapsible)**
- Wrapped in `<Collapsible>` with Globe icon header  
- Renders `travelIntelCards` prop content
- Only shows when `travelIntelCards` is provided

The essentials grid (timezone, currency, language, emergency) and flights/hotel info from the current Voyance Intelligence section move into Row 3's expanded content, below the stats badges.

### What stays unchanged
- SmartFinishBanner between tabs and the unified card
- Regeneration Loading Overlay after the card
- WhyWeSkippedSection, ParsedTripNotesSection
- TripDetail.tsx — no changes needed (desktop TravelIntelCard already removed, `travelIntelCards` prop already passed)
- All dialog/modal logic (regenerate confirm, share, optimize, route upgrade)

