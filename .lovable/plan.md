

## Fix: Align "Travel to Charles de Gaulle" Card with Desktop Layout

### The Problem

On desktop, regular activity cards use a structured layout:
- **Time column** (w-24, ~6rem) — shows departure/arrival times
- **Thumbnail column** (w-24, ~6rem) — shows activity image
- **Content area** — the actual card content

The `InterCityTransportCard` (used for the "Flight to Charles de Gaulle" departure card) bypasses this layout entirely. It renders with just `className="mx-3 sm:mx-4 my-1"` — meaning it sits flush against the left edge with only 16px margin on desktop. This makes it visually "too low" and misaligned compared to the activity cards above and below it.

### The Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`** (line ~9768-9775)

Update the desktop rendering of `InterCityTransportCard` to add left padding that aligns it with the content column of regular activity cards. The time + thumbnail columns together are `w-24 + w-24 = 12rem`, so the transport card needs `sm:pl-[12rem]` (or `sm:ml-[12rem]`) to start at the same horizontal position as activity content.

Change the `className` from:
```
className="mx-3 sm:mx-4 my-1"
```
to:
```
className="mx-3 sm:mx-4 sm:pl-[12rem] my-1"
```

Alternatively, wrap the desktop version in a flex layout that mirrors the time+thumbnail+content structure — but the padding approach is simpler and matches the pattern documented in the project memory.

This is a single-line CSS change that aligns the departure transport card with the content column on desktop while preserving the mobile layout.

### Files Changed
1. `src/components/itinerary/EditorialItinerary.tsx` — add `sm:pl-[12rem]` to InterCityTransportCard wrapper

