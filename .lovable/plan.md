

## Mobile UX Improvements — Plan

10 targeted CSS/layout fixes across 8 files. No logic changes.

### Fix 2.1: SignUp Name Fields Stack
**`src/components/auth/SignUpForm.tsx` (line 221)**
- `grid grid-cols-2 gap-3` → `grid grid-cols-1 sm:grid-cols-2 gap-3`

### Fix 2.2: Day Selector City Labels
**`src/components/itinerary/EditorialItinerary.tsx` (line 4967)**
- City name label: `max-w-[64px]` → `max-w-[48px] sm:max-w-[64px]` — tighter on mobile to prevent overflow
- On mobile, hide "Day" text prefix and show just the number: change line 4945 from `Day {day.dayNumber}` to use a responsive approach with `<span className="sm:hidden">D{day.dayNumber}</span><span className="hidden sm:inline">Day {day.dayNumber}</span>`

### Fix 2.3: TransportComparisonCard Mobile Layout
**`src/components/itinerary/TransportComparisonCard.tsx` (lines 116-155)**
- Wrap the top row in `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`
- Move cost to its own row on mobile: `sm:text-right` with full width below the operator info

### Fix 2.4 & 2.5: Activity Description + Transit Title
**`src/components/itinerary/EditorialItinerary.tsx`** — Check if ExpandableDescription and transit title wrap are already applied. If not:
- Activity descriptions: add line-clamp-2 with "Read more" expand
**`src/components/itinerary/TransitModePicker.tsx` (line 334)**
- `truncate` → `truncate sm:whitespace-normal` or remove truncate on mobile to allow wrapping

### Fix 2.6: SignIn Form Padding
**`src/pages/SignIn.tsx` (line 118)**
- `px-8 md:px-12 lg:px-14 xl:px-16` → `px-4 sm:px-8 md:px-12 lg:px-14 xl:px-16`

### Fix 2.7: OnboardConversation Textarea
**`src/pages/OnboardConversation.tsx` (line 313)**
- `min-h-[200px]` → `min-h-[120px] sm:min-h-[200px]`

### Fix 2.8: LiveItineraryView Day Number
**`src/components/itinerary/LiveItineraryView.tsx` (line 594)**
- `text-4xl sm:text-5xl` → `text-2xl sm:text-4xl`

### Fix 2.9: TransitBadge Mode Buttons
**`src/components/itinerary/TransitBadge.tsx` (line 174)**
- `flex flex-wrap items-center gap-1.5` → `flex overflow-x-auto gap-2 pb-1 scrollbar-hide sm:flex-wrap sm:overflow-visible`

### Fix 2.10: Dropdown Menus Off-Screen
**`src/components/itinerary/EditorialItinerary.tsx`**
- All `DropdownMenuContent align="end"` instances (lines 4317, 8307, 9676, 9825): add `sideOffset={4}` and change to `align="center"` on the activity-level dropdowns that appear near screen edges (9239, 9676, 9825)

TopNav doesn't use DropdownMenuContent (it uses a custom mobile menu), so no change needed there.

### Files to Modify
| File | Fixes |
|------|-------|
| `src/components/auth/SignUpForm.tsx` | 2.1 |
| `src/components/itinerary/EditorialItinerary.tsx` | 2.2, 2.4, 2.10 |
| `src/components/itinerary/TransportComparisonCard.tsx` | 2.3 |
| `src/components/itinerary/TransitModePicker.tsx` | 2.5 |
| `src/pages/SignIn.tsx` | 2.6 |
| `src/pages/OnboardConversation.tsx` | 2.7 |
| `src/components/itinerary/LiveItineraryView.tsx` | 2.8 |
| `src/components/itinerary/TransitBadge.tsx` | 2.9 |

