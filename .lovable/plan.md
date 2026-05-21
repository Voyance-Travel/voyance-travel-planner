# Reviews drawer scroll fix

## Root cause confirmed

`src/components/reviews/ReviewsDrawer.tsx:134` wraps the entire middle section (place details + rating distribution + the `sortedReviews.map(...)` list) in `<ScrollArea className="flex-1">`. Radix `ScrollArea` builds an internal `Viewport` whose computed height does not always pick up the flex parent's available space — once the inner content grows past ~5-6 review cards the viewport caps and the wheel/touch handler stops firing on the cards below the fold. This matches the reported "scroll freezes after 5-6 cards" symptom on Da Enzo al 29 (9 reviews).

## Fix (single file)

`src/components/reviews/ReviewsDrawer.tsx`:

1. **Line 123** — add `h-full` to `SheetContent` className so the flex column has a definite height to hand out:
   `"w-full sm:max-w-xl p-0 flex flex-col h-full"`

2. **Lines 134 + 424** — replace the `<ScrollArea className="flex-1">` opening and closing tags with a native flex-aware scroll div:
   - Open: `<div className="flex-1 min-h-0 overflow-y-auto">`
   - Close: `</div>`
   - `min-h-0` is the critical class that lets the flex child shrink below its content's intrinsic size, which is what unwedges the inner scroll. The existing inner `<div className="p-6 space-y-6">` keeps its padding, so visual layout is unchanged.

3. **Line 13** — remove the now-unused `ScrollArea` import.

This collapses to exactly one scroll container in the file (no nesting, which itself was the spec's stated failure mode).

## Out of scope

No changes to review fetching, sort logic, photo modal, capture popup, or review card rendering. No styling changes beyond the wrapper element type and one className addition.

## Acceptance

- `grep -n "flex-1 min-h-0 overflow-y-auto" src/components/reviews/ReviewsDrawer.tsx` → 1 hit (new wrapper)
- `grep -c "overflow-y-auto" src/components/reviews/ReviewsDrawer.tsx` → 1
- `grep -n "flex flex-col h-full" src/components/reviews/ReviewsDrawer.tsx` → 1 hit (SheetContent)
- Manual: Da Enzo al 29 (Rome Day 2) review panel scrolls smoothly through all 9 reviews; the two 3-star reviews at the bottom are reachable on desktop + mobile viewports.
