## Goal

Eliminate `reservationUrgency: .` and other prompt-leak/fragment substrings from every rendered activity description by routing seven unwrapped JSX reads through the existing `sanitizeActivityText` helper.

Out of scope: Bug #1 (missing meals / orphan transit) — deferred pending a runtime trace. Transit walk-mode override is already handled by the deployed `enforceTransitModeByDistance` guard.

## Changes

Apply the same idiom already in use at `src/components/itinerary/ItineraryEditor.tsx:1141`:

```tsx
{(() => { const d = sanitizeActivityText(activity.description); return d ? (
  <p className="...">{d}</p>
) : null; })()}
```

to seven sites:

| File | Line | Import action |
|---|---|---|
| `src/components/ActivityModal.tsx` | 103 | add `sanitizeActivityText` import |
| `src/components/booking/BookableItemCard.tsx` | 266–268 | extend existing `sanitizeActivityName` import |
| `src/components/booking/VoucherModal.tsx` | 118–119 | extend existing import |
| `src/components/itinerary/LiveItineraryView.tsx` | 277–279 | extend existing import |
| `src/components/itinerary/LiveActivityCard.tsx` | 175–177 | extend existing import |
| `src/components/guides/CommunityGuideActivityCard.tsx` | 88–89 | add new import |
| `src/components/demo/DemoArchetypeComparison.tsx` | 354 | add new import |

`sanitizeActivityText` already strips `Reservation Urgency: .`, label-only key:value lines, dot-only fragments, and truncated mid-sentence tails (per the unified output validation layer). Wrapping at the render boundary is the last-mile gate.

## Verification

- Open a trip with a known `Reservation Urgency: .` leak → confirm the substring no longer renders on activity cards, modal, voucher, live view, community guide cards, or demo comparison.
- Cards whose entire description was a leak collapse cleanly (no empty `<p>`).
- No other text fields (title, tips, notes) are touched — descriptions only, matching the verified scope.

## Notes

- Pure presentation-layer change; no edge-function or DB work.
- No new tests required: behavior of `sanitizeActivityText` is already covered; this just extends its reach.
