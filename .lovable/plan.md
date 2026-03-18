

## Fix: Preview Mode Toggle Not Working

### Investigation Summary

I traced the full data flow: `TripViewModeToggle` → `useTripViewMode.setMode()` → `setSearchParams()` → URL update → `rawMode` → `useMemo(mode)` → prop to `EditorialItinerary`.

### Root Cause

The preview mode state is stored in **URL search params** via `useSearchParams()`. Both `useTripViewMode` and `TripDetail.tsx` independently call `useSearchParams()`. This is a known React Router v6 issue — when multiple components hold separate `useSearchParams` instances and one calls `setSearchParams`, the other may not see the update in the same render cycle, or effects in TripDetail that call `setSearchParams` (e.g., cleaning up `?generate=true`) can overwrite the `mode` param before it takes effect.

Additionally, even when the URL does update, the `useMemo` dependency on `rawMode` (derived from `searchParams.get('mode')`) may not trigger a re-render if React Router's internal state update doesn't propagate to the hook's `searchParams` instance immediately.

### Fix: Use React state instead of URL params

Replace the URL-based approach with a simple `useState` lifted into TripDetail. This eliminates the React Router search params race condition entirely.

| # | File | Change |
|---|------|--------|
| 1 | `src/hooks/useTripViewMode.ts` | Accept optional `externalMode` and `onModeChange` callback. Remove `useSearchParams` dependency. Use simple internal state with `useState` as the default, or defer to external state when provided. |
| 2 | `src/pages/TripDetail.tsx` | No change needed — the hook already returns `mode` and `setMode` which TripDetail consumes. The hook change is internal. |

### Simplified `useTripViewMode` approach

```typescript
export function useTripViewMode({ isOwner, canEdit = false }: UseTripViewModeOptions) {
  const hasEditAccess = isOwner || canEdit;
  
  // Use simple React state instead of URL search params
  const [internalMode, setInternalMode] = useState<TripViewMode>(
    hasEditAccess ? 'edit' : 'preview'
  );
  
  const mode: TripViewMode = hasEditAccess ? internalMode : 'preview';
  
  const setMode = useCallback((newMode: TripViewMode) => {
    if (!hasEditAccess) return;
    setInternalMode(newMode);
  }, [hasEditAccess]);

  return {
    mode,
    setMode,
    isPreviewMode: mode === 'preview',
    isEditMode: mode === 'edit',
    canToggle: hasEditAccess,
  };
}
```

This is a single-file change. The toggle button, TripDetail, and EditorialItinerary all consume the same `mode`/`setMode` interface, so no downstream changes are needed.

