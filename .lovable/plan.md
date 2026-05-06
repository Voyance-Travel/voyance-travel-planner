## Root cause

`WhyWeSkippedSection` (the "Better Alternatives" card) renders only its `skippedItems` array — there is no awareness of the loading state from `useSkipList`. `useSkipList` already exposes `isLoading`, but it isn't passed in.

For destinations with no hardcoded fallback in `getDestinationSkippedItems`, the initial array is `[]`, so:
1. The panel returns `null` (L39 `if (skippedItems.length === 0) return null`) — but if a hardcoded fallback exists it shows immediately, then re-populates after the AI fetch (~4 s) with no indication anything is happening.
2. When a user opens the section while a refresh is in-flight, the body shows nothing for the duration of the request.

The user's report ("blank card, then 5 alternatives load after 4 s") matches the case where the AI call replaces an initially-rendering set, OR the card mounts in a state where `skippedItems` are loading but already counted in the header subtitle from a stale render.

## Fix

Wire `isLoading` from `useSkipList` into `WhyWeSkippedSection` and render a clear loading affordance.

### Changes

**1. `src/components/itinerary/WhyWeSkippedSection.tsx`**
- Add `isLoading?: boolean` to `WhyWeSkippedSectionProps`.
- Adjust the early-return: render the panel when `skippedItems.length > 0` **or** `isLoading`. (Hide entirely only when both empty and not loading.)
- Header subtitle while loading + empty: show `"Finding local picks for {destination}…"` and a small `Loader2` spinner next to the count instead of "X local picks".
- Expanded body while `isLoading` and items length is 0: render 3 skeleton rows (rounded-lg shimmer using existing `Skeleton` from `@/components/ui/skeleton`) so the card is visibly working.
- If items already exist and `isLoading` is true (background refresh), keep showing items, but place a tiny inline `Loader2` + "Refreshing…" hint at the bottom of the list.

**2. `src/components/itinerary/EditorialItinerary.tsx`**
- Destructure `isLoading` from `useSkipList` (L3102) — `const { skippedItems, isLoading: isLoadingSkipList } = useSkipList(destination);`
- Pass `isLoading={isLoadingSkipList}` to `<WhyWeSkippedSection>` at L5970.

## Out of scope

- Changes to the `useSkipList` fetching logic, edge function, or caching policy.
- Other intelligence panels.

## Verification

1. Open a trip whose destination has no hardcoded skip list. Confirm the Better Alternatives card mounts immediately with a spinner + "Finding local picks…" subtitle, expanded shows skeleton rows, then real items replace them.
2. Open a trip with a hardcoded fallback. Confirm items show instantly; if a background refresh runs, a small "Refreshing…" hint appears momentarily.
3. After load completes with zero results and zero fallback, the card disappears (no blank shell).
