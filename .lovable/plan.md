

## Fix: NightsRedistributionModal Not Showing Cities

**Root Cause**: Line 40 of `NightsRedistributionModal.tsx` uses `useState()` as a side effect to reset state when new data arrives — but `useState` with a callback only runs once on mount as an initializer. It never re-runs when `initialRedistribution` changes. So the modal always shows the stale/empty initial state (0 cities, "0 / 3").

**Fix** (single file change in `NightsRedistributionModal.tsx`):

Replace the broken `useState` call (lines 39-42) with a proper `useEffect` that resets `redistribution` whenever `initialRedistribution` changes or the modal opens:

```tsx
// Before (broken):
useState(() => {
  setRedistribution(initialRedistribution);
});

// After (correct):
useEffect(() => {
  setRedistribution(initialRedistribution);
}, [initialRedistribution]);
```

This will also require adding `useEffect` to the imports from React (line 1 currently imports `useState, useMemo`).

No other files need changes — the parent (`TripDetail.tsx`) already passes the correct `initialRedistribution` and `totalNights`. The +/- buttons and city list are already coded in the modal; they just weren't rendering because the redistribution array was empty.

