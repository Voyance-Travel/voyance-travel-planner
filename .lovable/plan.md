

## Remove All Em Dashes from User-Facing UI

### Scope
Replace every em dash (—) in rendered UI text across all non-admin `.tsx` files. Comments are left alone. Each em dash is replaced with a comma, period, or restructured phrasing per Voyance editorial standards.

### Files and Changes

**1. `src/pages/FoundersGuideDetail.tsx` (line 199)**
- `"That's the Voyance promise — we don't..."` → `"That's the Voyance promise. We don't..."`

**2. `src/components/itinerary/EditorialItinerary.tsx` (line 9205)**
- `"have no travel buffer —"` → `"have no travel buffer."`

**3. `src/components/guides/EditorialStatusCard.tsx` (line 103)**
- `"...to unlock your editorial — a polished..."` → `"...to unlock your editorial, a polished..."`

**4. `src/components/trips/TripOverview.tsx` (line 269)**
- `"Free day — explore at your pace"` → `"Free day. Explore at your pace"`

**5. `src/components/planner/budget/BudgetTab.tsx` (line 661)**
- `"No flight cost added yet — add one..."` → `"No flight cost added yet. Add one..."`

**6. `src/components/demo/DemoFeatureShowcase.tsx` (lines 774, 778)**
- `"Kinkaku-ji Temple Tour — 3 hrs"` → `"Kinkaku-ji Temple Tour, 3 hrs"`
- `"Zen Garden Meditation — 1.5 hrs"` → `"Zen Garden Meditation, 1.5 hrs"`

**7. `src/pages/Start.tsx` (line 2031)**
- `"Enter the nightly rate — we'll calculate..."` → `"Enter the nightly rate. We'll calculate..."`

**8. `src/components/planner/ManualTripPasteEntry.tsx` (line 341)**
- `"No dates detected — add them now..."` → `"No dates detected. Add them now..."`

**9. `src/components/itinerary/RefreshDayDiffView.tsx` (line 121)**
- `"All issues can be resolved — review..."` → `"All issues can be resolved. Review..."`

**10. `src/components/guides/EditorialShareSection.tsx` (lines 34, 44)**
- `"${title}" — my travel guide on Voyance"` → `"${title}" - my travel guide on Voyance"`
- `"${title} — a travel guide on Voyance"` → `"${title} - a travel guide on Voyance"`

### Total
10 files, ~12 string replacements. No logic changes.

