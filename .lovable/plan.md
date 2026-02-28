

# Itinerary Tooltips & Feature Discovery (v2)

## Overview

Replace the current 11-step onboarding tour and bare `title` attributes with a three-tier progressive disclosure system: a focused 7-step guided tour, styled Radix tooltips on icon-only buttons, contextual first-use hints, and a persistent "?" help button.

---

## Tier 2: Smart Tooltips (Priority 1 -- fastest win)

**What**: Replace HTML `title` attributes on ~12 icon-only buttons with styled `<Tooltip>` components using the existing Radix-based `src/components/ui/tooltip.tsx`. Remove the `title` after wrapping.

**File: `src/components/itinerary/EditorialItinerary.tsx`** (main itinerary -- ~7900 lines)

Wrap these icon-only elements:

| Element (approx line) | Current `title` | New Tooltip Label |
|---|---|---|
| Route toggle (~6641) | "Show/Hide route details" | Show Routes / Hide Routes |
| Lock Day button (~6654) | "Lock/Unlock Day" | Lock Day / Unlock Day |
| Regenerate Day button (~6665) | "Regenerate Day" | Regenerate Day |
| Collapse/Expand chevron (~6679) | "Collapse/Expand" | Collapse Day / Expand Day |
| Activity lock button (~7592) | "Lock/Unlock to edit" | Lock Activity / Unlock Activity |
| Three-dot menu (~7604) | aria-label only | More Options |
| Currency toggle (~3334) | "Switch to USD/local" | Switch Currency |
| Day cost badge (~6621) | none | Day Cost Estimate |

**File: `src/components/itinerary/ItineraryAssistant.tsx`**
- Chat bubble trigger button: tooltip "Trip Assistant"

**File: `src/components/itinerary/FullItinerary.tsx`**
- Lock, Edit, Move Up, Move Down, Remove buttons (~lines 548-590): replace `title` attrs with tooltips

**Tooltip style**: Use existing `<Tooltip>` with `delayDuration={200}`. Content uses `<span className="text-xs font-medium">`. Dark theme inherits from the existing popover styles.

**Pattern:**
```tsx
<Tooltip delayDuration={200}>
  <TooltipTrigger asChild>
    <Button aria-label="Lock Day" ...>
      <LockIcon />
    </Button>
  </TooltipTrigger>
  <TooltipContent side="bottom">
    <span className="text-xs font-medium">Lock Day</span>
  </TooltipContent>
</Tooltip>
```

Remove the `title` attribute from each wrapped element to avoid doubling.

---

## Tier 1: 7-Step Guided Tour (Priority 2)

**File: `src/components/itinerary/ItineraryOnboardingTour.tsx`**

Replace the current 11 `TOUR_STEPS` with 7 zone-grouped steps per spec:

| Step | Target selector | Copy (abbreviated) |
|---|---|---|
| 1: Trip at a Glance | `[data-tour="value-header"]` | Intelligence summary + hours saved |
| 2: Trip Health | `[data-tour="health-score"]` | Health Score tracks trip-readiness |
| 3: Share, Optimize, Export | `[data-tour="trip-actions"]` | Share/Optimize/Export toolbar row |
| 4: Your Day, Your Way | `[data-tour="day-header"]` | Day block header -- cost, routes, lock, regen |
| 5: Customize Activity | `[data-tour="activity-card"]` | Three-dot menu, lock, 3 free swaps |
| 6: AI Trip Assistant | `[data-tour="chat-bubble"]` | Chat assistant, 5 free messages |
| 7: Beyond the Itinerary | `[data-tour="tab-bar"]` | Budget, Payments, Details, Need to Know tabs |

**Add `data-tour` attributes** in `EditorialItinerary.tsx`:
- `data-tour="value-header"` on the `<ItineraryValueHeader>` wrapper
- `data-tour="health-score"` on the health badge
- `data-tour="trip-actions"` on the action buttons `<div>` (~line 3344)
- `data-tour="day-header"` on the teal day banner div
- `data-tour="activity-card"` on the first activity card
- `data-tour="tab-bar"` on the tab container (~line 3243)
- `data-tour="chat-bubble"` on the assistant trigger in `ItineraryAssistant.tsx`

**Entry banner**: Before the tour auto-starts, show a soft inline banner: "First time here? Take a quick tour." with "Show me" (primary) and "Skip" (text link). This replaces the current auto-start behavior.

**Tour completion**: Keep existing localStorage + Supabase `onboarding_state` persistence (already working).

---

## Tier 3: Contextual First-Use Hints (Priority 3)

**New file: `src/hooks/useFirstUseHint.ts`**

A thin hook wrapping `useFirstTimeTooltip` pattern but persisting to Supabase `onboarding_state` JSONB (not just localStorage):

```typescript
function useFirstUseHint(key: string): { shouldShow: boolean; dismiss: () => void }
```

**New file: `src/components/itinerary/FirstUseHint.tsx`**

A reusable callout component: colored banner with message text, "Got it" dismiss link, optional auto-dismiss timer.

**7 hints to implement:**

| Hint | Trigger location | File to modify | onboarding_state key |
|---|---|---|---|
| Share modal | Inside Share modal | `TripShareModal.tsx` | `share_hint_shown` |
| Budget tab | Budget tab content | `EditorialItinerary.tsx` (budget section) | `budget_hint_shown` |
| Payments tab | Payments tab content | `PaymentsTab.tsx` | `payments_hint_shown` |
| First swap | Swap results area | Swap results component | `swap_hint_shown` |
| First lock | Lock action handler | `EditorialItinerary.tsx` lock handler | `lock_hint_shown` |
| Optimize nudge | 3+ visits without optimize | `EditorialItinerary.tsx` | `optimize_nudge_shown` |
| Discovery sections | 2+ visits without expanding | `ParsedTripNotesSection.tsx` | `sections_nudge_shown` |

For Hint 5 (first lock), enhance the existing lock toast message to include "stays put when you optimize or regenerate" context.

For Hint 6 (optimize nudge), track visit count in localStorage. On 3rd visit, add a temporary pulse class to the Optimize button and auto-show its tooltip.

For Hint 7 (discovery sections), add a pulsing dot indicator on collapsed section chevrons after 2+ visits without expansion.

**Onboarding state schema update**: Add new fields to the `OnboardingState` interface in `src/utils/onboardingState.ts`:
```typescript
share_hint_shown?: boolean;
budget_hint_shown?: boolean;
payments_hint_shown?: boolean;
swap_hint_shown?: boolean;
lock_hint_shown?: boolean;
optimize_nudge_shown?: boolean;
sections_nudge_shown?: boolean;
```

No database migration needed -- the column is JSONB and accepts any keys.

---

## Persistent "?" Help Button (Priority 4)

**New file: `src/components/itinerary/HelpButton.tsx`**

- Position: fixed bottom-left (chat is bottom-right)
- Style: 28px muted circle, "?" text, 40% opacity, 70% on hover
- On click: Popover with two options:
  - **Retake Tour** -- clears localStorage key, calls `useResetItineraryTour()` (already exists), re-triggers tour
  - **Feature Guide** -- compact card listing 10 key features with icons and one-liner descriptions

**Render in**: `EditorialItinerary.tsx`, after tour completes or always (shown only when tour is NOT active).

---

## Files Changed Summary

| File | Changes |
|---|---|
| `src/components/itinerary/EditorialItinerary.tsx` | Add `data-tour` attrs, wrap ~8 icon buttons with `<Tooltip>`, remove `title` attrs, add FirstUseHint for budget/payments/optimize, render HelpButton |
| `src/components/itinerary/ItineraryOnboardingTour.tsx` | Replace 11 steps with 7 grouped steps, add entry banner |
| `src/components/itinerary/ItineraryAssistant.tsx` | Add `data-tour="chat-bubble"`, tooltip on trigger |
| `src/components/itinerary/FullItinerary.tsx` | Replace `title` attrs with `<Tooltip>` on 5 buttons |
| `src/utils/onboardingState.ts` | Add 7 new hint keys to interface |
| `src/hooks/useFirstUseHint.ts` | **New** -- first-use hint hook |
| `src/components/itinerary/FirstUseHint.tsx` | **New** -- reusable hint callout component |
| `src/components/itinerary/HelpButton.tsx` | **New** -- persistent "?" button with popover |
| `src/components/sharing/TripShareModal.tsx` | Add share first-use hint |
| `src/components/itinerary/PaymentsTab.tsx` | Add payments first-use hint |
| `src/components/itinerary/ParsedTripNotesSection.tsx` | Add pulsing dot for discovery sections |

---

## What Does NOT Get a Tooltip

Per spec, buttons with visible text labels (Share, Optimize, Export PDF, Add Flight, tab labels, section headers, day selector pills, activity names) are explicitly excluded.

