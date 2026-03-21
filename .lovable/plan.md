

## Fix: Tone Down Transport Cards + Fix Checkout-Before-Flight Ordering

### Problem 1: Inter-city transport cards look childish
The `InterCityTransportCard` uses loud colored left borders, colored backgrounds, colored icon backgrounds, colored accent text, and colored route dots per transport mode (blue for flights, emerald for trains, amber for buses, etc.). This makes them visually jarring compared to the clean, neutral activity cards used everywhere else.

### Problem 2: Flight appears before hotel checkout on transition days
On transition days (city A → city B), the transport card is blindly prepended to the top of all activities at line 1547:
```
updatedActivities = [...travelCards, ...updatedActivities];
```
This means if checkout is at 8:00 AM and the flight is at 8:00 AM, the flight card shows FIRST. There's checkout-ordering logic for departure days (lines 1740-1752) but none for transition days.

### Changes

**File 1: `src/components/itinerary/InterCityTransportCard.tsx`**

Strip the per-mode color theming. Use a single neutral style matching normal activity cards:
- Remove the `TRANSPORT_THEMES` color map entirely
- Keep the transport-type icons (Plane, Train, Bus, Ship, Car) but render them in muted foreground color
- Card styling: `bg-card border border-border rounded-xl shadow-sm` (same as activity cards)
- Remove the colored left border, colored backgrounds, colored dots, colored accent text
- Route dots become neutral `bg-muted-foreground`
- Icon background becomes `bg-muted`
- Transport label becomes `text-muted-foreground` instead of colored
- The "final" variant keeps a subtle primary accent (it's the homebound card) but toned down

**File 2: `src/components/itinerary/EditorialItinerary.tsx` (~line 1547)**

Add checkout-aware insertion for transition days, matching the logic already used for departure days (lines 1740-1752):

Instead of:
```typescript
updatedActivities = [...travelCards, ...updatedActivities];
```

Do:
1. Find the checkout activity in `updatedActivities` using the same keyword check (`check out`, `checkout`, `check-out`, `__hotelCheckout`)
2. Insert the travel card AFTER the checkout activity
3. If checkout has no time or its time is >= the transport departure time, set checkout time to transport departure minus 60 minutes (minimum 07:00)
4. If no checkout exists, insert chronologically based on `depTime` (or prepend if no depTime)

This ensures the order is always: Checkout → Transport → Arrival activities.

### Scope
2 files. `InterCityTransportCard.tsx` (visual restyle, ~30 lines changed). `EditorialItinerary.tsx` (~15 lines around line 1547 to add checkout-aware ordering for transition days).

