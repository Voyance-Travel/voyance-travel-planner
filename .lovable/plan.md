

## Fix: Inconsistent Title vs. Subtext on Activity Cards

### The Problem
For **dining activities**, the card swaps what's shown as the title depending on context:
- **Desktop card**: Shows the **venue name** (e.g., "Mandarin Oriental") as the big h4 title, with the actual activity title (e.g., "Lunch at Mandarin Oriental") as italic subtext
- **Mobile collapsed**: Shows the **activity title** as the main text
- **Clean preview**: Shows **venue name** as title, activity title as italic subtext
- **Non-dining activities**: Always show **activity title** as the h4

This is confusing — the title should always be the title.

### The Fix
Make the activity title (`activityTitle`) the primary heading everywhere. Show the venue/location name as secondary info (below the title, like the non-dining path already does with `location.name`).

### Changes — Single File

**`src/components/itinerary/EditorialItinerary.tsx`**

1. **Desktop dining branch (lines ~9777-9810)**: Swap the hierarchy — `activityTitle` becomes the h4, venue name becomes a location-style line below it (with MapPin icon, matching the non-dining pattern).

2. **Clean preview branch (lines ~9387-9392)**: Same fix — always use `activityTitle` as the h4 title. Show venue as a secondary location line instead of swapping it into the title position.

### Before → After

**Desktop dining card:**
```
Before:                          After:
┌──────────────────┐            ┌──────────────────┐
│ Mandarin Oriental│ (h4)       │ Lunch at Hotel   │ (h4)
│ Lunch at Hotel   │ (italic)   │ 📍 Mandarin Oriental │ (location)
│ 📍 123 Street    │ (address)  │    123 Street     │ (address)
└──────────────────┘            └──────────────────┘
```

**Clean preview:**
```
Before:                          After:
│ Mandarin Oriental│ (h4)       │ Lunch at Hotel   │ (h4)
│ Lunch at Hotel   │ (italic)   │ 📍 Mandarin Oriental │ (location)
```

This makes title always = title, everywhere. The venue name still appears prominently as the location line, so no information is lost.

