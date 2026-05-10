## Problem

`useGenerateTripPreview` (Quick) and `useGenerateFullPreview` (Full) both register with React Query using **static string** `mutationKey`s:

- `src/services/tripPreviewService.ts:189` → `mutationKey: ['generate-trip-preview']`
- `src/services/fullPreviewService.ts:150` → `mutationKey: ['generate-full-preview']`

Because the keys do not include `previewType`/`destination`/`startDate`/`endDate`, every call from any consumer with the same hook shares the same mutation slot. When a user generates a Quick preview for `Paris 2026-06-01..06-05` and then immediately requests a Full preview (or switches destinations), other components subscribed to the same hook can read the prior cached `data` and render a stale Quick preview while the new Full request is in-flight. This is the HIGH-6 carryover from build (7).

## Fix

Make the `mutationKey` a function of `(previewType, destination, startDate, endDate)` so each unique request gets its own cache slot and previously-resolved Quick state cannot be served when Full is requested (and vice-versa).

### `src/services/tripPreviewService.ts` (~line 186-191)

```ts
export function useGenerateTripPreview() {
  return useMutation({
    mutationFn: generateTripPreview,
    mutationKey: ['preview', 'quick'] as const,
  });
}
```

Change `mutationFn` wrapper so the per-call key is set via `useMutation`'s `mutationKey` factory pattern. Concretely, expose an overload that accepts the request and constructs the discriminated key. The simplest in-place change:

```ts
export function useGenerateTripPreview(params?: Pick<GeneratePreviewParams, 'destination' | 'startDate' | 'endDate'>) {
  return useMutation({
    mutationFn: generateTripPreview,
    mutationKey: [
      'preview',
      'quick',
      params?.destination ?? '',
      params?.startDate ?? '',
      params?.endDate ?? '',
    ],
  });
}
```

### `src/services/fullPreviewService.ts` (~line 147-152)

Mirror the same pattern with `'full'` discriminator:

```ts
export function useGenerateFullPreview(params?: Pick<FullPreviewRequest, 'destination' | 'startDate' | 'endDate'>) {
  return useMutation({
    mutationFn: generateFullPreview,
    mutationKey: [
      'preview',
      'full',
      params?.destination ?? '',
      params?.startDate ?? '',
      params?.endDate ?? '',
    ],
  });
}
```

The `'trip'` slot in the user's discriminator union (`'quick' | 'full' | 'trip'`) is reserved — no third hook exists today, but the namespace shape `['preview', <type>, …]` accommodates it without future churn.

### Update call sites

Pass the current request's `destination`/`startDate`/`endDate` into the hooks so the key changes when the user switches trips:

- `src/components/home/DestinationEntry.tsx`
- `src/components/home/QuickPreviewDisplay.tsx`
- any other consumer of `useGenerateTripPreview` / `useGenerateFullPreview`

Where the hook is called before those values are known, `params` stays `undefined` and the key falls back to `['preview', '<type>', '', '', '']` — still discriminated by type, which alone fixes the Quick↔Full cross-pollution.

## Verification

1. `rg -n "mutationKey" src/services/tripPreviewService.ts src/services/fullPreviewService.ts` → keys include `'preview'` namespace + type + dest + dates.
2. Manual repro: generate Quick preview for Destination A → switch to Destination B and request Full preview → confirm UI never flashes A's Quick result during B's Full in-flight.
3. React Query devtools: each unique (type, dest, dates) tuple shows as its own mutation entry.

## Out of scope

- No server-side cache changes (no DB-level preview cache exists today).
- No changes to `generateTripPreview` / `generateFullPreview` request bodies.
- No new third "trip" preview hook — namespace is reserved only.