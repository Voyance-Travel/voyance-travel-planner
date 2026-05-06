## Root cause

Tab content in `src/components/itinerary/EditorialItinerary.tsx` is wrapped in a single `<AnimatePresence mode="wait">` (L5464) that gates ~6 sibling `motion.div` blocks on `activeTab === '...'`.

`mode="wait"` defers mounting the **next** child until the **previous** child's `exit` animation has fully resolved. The exit animations use only `exit={{ opacity: 0 }}` with no explicit transition. Combined with:

- React 18 concurrent rendering batching the state update,
- `NeedToKnowSection` being a heavy subtree (data fetches, multiple cards) whose unmount is not synchronous,
- and the shared `layoutId="editorialItineraryTab"` underline animating on its own track,

the underline updates immediately (not gated by AnimatePresence), but the new tab body waits for the exit to complete. In practice the exit promise can hang until the next interaction kicks the reconciler, so the user sees a "ghost" state requiring a second click.

This is a known `mode="wait"` pitfall when the leaving subtree is expensive.

## Fix

Switch tab content to `mode="popLayout"` (or remove `mode="wait"` entirely). This mounts the incoming tab immediately so content swaps on the first click, while still allowing the outgoing tab to fade out underneath. The underline animation already uses `layoutId` and works independently.

### Change

In `src/components/itinerary/EditorialItinerary.tsx` (L5464):
- `<AnimatePresence mode="wait">` → `<AnimatePresence mode="popLayout" initial={false}>`
  - `initial={false}` suppresses the entrance animation on first render so the initial tab doesn't fade in awkwardly.
  - `popLayout` keeps the exiting child in flow visually while the new child mounts immediately, eliminating the double-click.

If `popLayout` causes a brief overlap visual glitch, fallback alternative: drop AnimatePresence entirely for tab content and keep only the underline `layoutId` animation on the trigger row.

## Out of scope

- Refactoring NeedToKnowSection performance.
- Tab persistence / URL sync.
- The mobile overflow dropdown (already works via direct state set).

## Verification

1. Navigate to a trip → Need to Know tab → click Budget. Content must swap on the first click.
2. Repeat in the other direction (Budget → Need to Know, Itinerary → Need to Know → Budget).
3. Confirm the underline still slides smoothly between tabs.
4. Confirm no console warnings from framer-motion about layout/keys.
