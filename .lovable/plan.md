

## Rename "planned" → "crafted by Voyance" in Top-Level Itinerary Summary

### Problem
The word "planned" is used in two contexts: (1) the top summary ("5 of 5 days planned") meaning "generated/filled," and (2) the per-day lock status "planned." This creates confusion.

### Changes

**1. `src/components/trip/TripHealthPanel.tsx`** — Main itinerary header
- Line 317: `{daysPlanned} of {totalDaysExpected} days planned` → `{daysPlanned} of {totalDaysExpected} days crafted by Voyance`
- Line 210: `All ${totalDaysExpected} days planned` → `All ${totalDaysExpected} days crafted`
- Line 212: `Days 1-${planned} planned` → `Days 1-${planned} crafted`

**2. `src/pages/Profile.tsx`** — Trip cards on profile
- Line 126: `${daysWithActivities}/${totalDays} days planned` → `${daysWithActivities}/${totalDays} days crafted`
- Line 132: `Fully planned` → `Fully crafted`
- Line 134: `${daysWithActivities}/${totalDays} days planned` → `${daysWithActivities}/${totalDays} days crafted`

**3. `src/components/planner/steps/ItineraryPreview.tsx`** — Post-generation summary
- Line 735: `{days.length} days planned` → `{days.length} days crafted by Voyance`

**4. `src/components/planner/ItineraryGeneratorStreaming.tsx`** — Streaming summary
- Line 266: `{days.length} days planned` → `{days.length} days crafted by Voyance`

**5. `src/components/agent/TripCockpit.tsx`** — Agent cockpit label
- Line 144: `Days Planned` → `Days Crafted`

**No changes** to per-day "planned" lock status — that remains as-is.

