

## Fix TransitModePicker: Switch from `airport-transfers` to `transfer-pricing` + Add Walking Support

### Problem
The `TransitModePicker` component (line 126) calls the `airport-transfers` edge function, which returns hardcoded options without walking support. It should call `transfer-pricing` instead, which uses Google Maps Distance Matrix API and returns walking options when routes are ≤30 min.

### Root Cause
`src/components/itinerary/TransitModePicker.tsx` line 126:
```ts
const { data, error } = await supabase.functions.invoke('airport-transfers', { ... });
```
The `airport-transfers` function never returns a "Walk" option. The `transfer-pricing` function does (line 476-490 of that function).

### Changes

**File: `src/components/itinerary/TransitModePicker.tsx`**

1. **Switch edge function call** (line 126): Change `'airport-transfers'` to `'transfer-pricing'` and update the request body to match `transfer-pricing`'s expected format:
   ```ts
   const { data, error } = await supabase.functions.invoke('transfer-pricing', {
     body: {
       origin: activity.venue || activity.address || city,
       destination: transitDestination,
       city,
       travelers: 2,
       transferType: 'point_to_point',
     },
   });
   ```

2. **Map response shape**: The `transfer-pricing` function returns `TransferOption` objects with fields like `title`, `duration`, `durationMinutes`, `priceFormatted`, `priceTotal`, `mode`, `notes`, `trainLine`, `isBookable`, `bookingUrl`. The current `TransportOptionData` interface expects `label`, `estimatedCost`, `icon`, `route`, `pros`, `cons`, `bookingTip`. Update the interface and mapping:

   - Replace `TransportOptionData` interface with the shape from `transfer-pricing`:
     ```ts
     interface TransportOptionData {
       id: string;
       mode: string;
       title: string;          // was "label"
       duration: string;
       durationMinutes: number;
       priceTotal: number;
       priceFormatted: string;  // was "estimatedCost"
       distance?: number;
       notes?: string;
       trainLine?: string;
       isBookable: boolean;
       bookingUrl?: string;
       recommended?: boolean;   // keep for UI
       source: string;
       confidence: number;
     }
     ```

   - Update response parsing (line 134): Map `data.options` directly (shape already matches). Set recommended from `data.recommendedOption`. Store `data.googleMapsData` for route display. Filter out airport-specific options for non-airport routes.

3. **Update rendering** (lines 316-422): Change references from `option.label` → `option.title`, `option.estimatedCost` → `option.priceFormatted`, `option.icon` → use `getModeIcon(option.mode)`. Remove `option.route`/`option.pros`/`option.cons`/`option.bookingTip` detail expansion (not in new shape) — replace with `option.notes` and `option.trainLine` display.

4. **Update `handleSelectOption`** (line 155): Change `option.label` → `option.title`, parse cost from `option.priceTotal` instead of regex on `option.estimatedCost`.

5. **Add Google Maps route summary**: Show origin → destination with distance when `googleMapsData` is available, above the options list.

6. **Add `travelers` prop** to the interface (currently missing) and pass it in the edge function call. In `EditorialItinerary.tsx` line 8544, add `travelers={travelers}` prop.

### Files to modify
- `src/components/itinerary/TransitModePicker.tsx` — main changes
- `src/components/itinerary/EditorialItinerary.tsx` — pass `travelers` prop (line ~8556)

