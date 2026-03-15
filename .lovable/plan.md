

## Polish Fixes — Plan

7 visual refinements across 7 files.

### Fix 3.1: Hero Image Height
**`src/pages/TripDetail.tsx` (line 1909)**
- `h-40 sm:h-56 md:h-72` → `h-28 sm:h-40 md:h-56 lg:h-72`

### Fix 3.2: Mobile Cost Abbreviation
**New file: `src/utils/formatCostMobile.ts`**
- Create a utility that formats numbers: values >= 1000 become `$1.2K`, under 1000 stay as-is
- Export both `formatCostMobile(amount, currency?)` and a React-friendly component or hook approach
- This is a utility only — integration into specific components can happen incrementally

### Fix 3.3: Weather Grid → Horizontal Scroll on Mobile
**`src/components/itinerary/WeatherForecast.tsx` (lines 218-221)**
- Replace the dynamic `grid-cols-N` with a horizontal scroll on mobile:
  - `flex overflow-x-auto gap-2 pb-2 scrollbar-hide sm:grid sm:gap-2` with appropriate `sm:grid-cols-N`
- Each forecast card gets `min-w-[72px] flex-shrink-0 sm:min-w-0` to size properly in the scroll row

### Fix 3.4: Password Requirements Stack
**`src/components/auth/SignUpForm.tsx` (line 302)**
- `grid grid-cols-2 gap-1` → `grid grid-cols-1 sm:grid-cols-2 gap-1`

### Fix 3.5: Explore Filters as Bottom Sheet on Mobile
**`src/components/explore/FilterPanel.tsx`**
- Wrap the filter panel in a bottom-sheet-style container on mobile: fixed bottom-0 with rounded top corners, backdrop overlay, and drag-to-dismiss via a swipe handle
- On `sm:` and up, keep the current inline card behavior
- Add a `<div className="sm:hidden w-12 h-1 bg-muted rounded-full mx-auto mb-4" />` drag handle
- Use `fixed inset-0 z-50 sm:relative sm:z-auto` pattern to overlay on mobile, inline on desktop

### Fix 3.6: Hide Decorative Motifs on Mobile
**`src/pages/Quiz.tsx` (lines 143-149)**
- Wrap the 6 `<FloatingMotif>` elements in a `<div className="hidden sm:block">` container

### Fix 3.7: Forgot Password Link Wrapping
**`src/components/auth/SignInForm.tsx` (line 143)**
- `flex items-center justify-between` → `flex flex-wrap items-center justify-between gap-1`

### Files to Modify
| File | Fix |
|------|-----|
| `src/pages/TripDetail.tsx` | 3.1 |
| `src/utils/formatCostMobile.ts` (new) | 3.2 |
| `src/components/itinerary/WeatherForecast.tsx` | 3.3 |
| `src/components/auth/SignUpForm.tsx` | 3.4 |
| `src/components/explore/FilterPanel.tsx` | 3.5 |
| `src/pages/Quiz.tsx` | 3.6 |
| `src/components/auth/SignInForm.tsx` | 3.7 |

