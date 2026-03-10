

## Plan: Remove Noisy Toasts — 16 Exact Changes

All changes are simple line deletions or string replacements across 7 files. No structural or logic changes.

### Deletions (remove toast line entirely)

| # | File | Line | Toast to delete |
|---|------|------|----------------|
| 1 | `TripDetail.tsx` | 910 | `toast.success('Trip pricing synced...')` |
| 2 | `EditorialItinerary.tsx` | 2257 | `toast.success('Day 1 and final day synced...')` — also remove the else block (lines 2256-2260) replacing with just the else body |
| 3 | `EditorialItinerary.tsx` | 2870 | The pricing repair success toast was already removed in a prior pass — the current code at ~2870 has no toast. Confirmed no action needed. |
| 5 | `FindMyHotelsDrawer.tsx` | 113 | `toast.success('Finding your perfect hotels (X credits used)')` |
| 7 | `ItineraryGenerator.tsx` | 642 | `toast('Checking generation status...')` |
| 8 | `ItineraryGenerator.tsx` | 703 | `toast('Generation paused while we verify...')` |
| 9 | `ItineraryGenerator.tsx` | 707 | `toast('Generation completed. Finalizing...')` |
| 11 | `useItineraryGeneration.ts` | 532 | `toast.success('Itinerary saved successfully!')` |
| 12 | `ItineraryEditor.tsx` | 294 | `toast.success('Itinerary saved successfully!')` |
| 13 | `useStalePendingChargeRefund.ts` | 122-124 | `toast.info('A previous Smart Finish attempt failed...')` |

### Replacements

| # | File | Line | Before → After |
|---|------|------|----------------|
| 4 | `EditorialItinerary.tsx` | 2525-2529 | Both swap toast branches → single `toast.success('Activity swapped!')` |
| 6 | `ItineraryGenerator.tsx` | 257 | `toast.success('Trip generated! X credits used')` → `toast.success('Your itinerary is ready!', { duration: 4000 })` |
| 10 | `ItineraryGenerator.tsx` | 694 | Long generation-stopped message → `'Generation paused. Your progress has been saved.'` (keep the full-refund else branch as `'Generation failed. Your credits have been refunded.'`) |
| 14 | `EditorialItinerary.tsx` | 2999 | `'Your routes are already optimized! Credits refunded.'` → `'Routes are already optimized!'` with `duration: 3000` |
| 15 | `EditorialItinerary.tsx` | 3501-3503 | `'Schedule synced to flight times'` → `toast.success('Schedule updated!', { id: 'flight-sync', duration: 2000 })` (drop the description) |
| 16 | `voyanceFlowController.ts` | 211 | `return \`\${actionLabel} (\${result.cost} credits used)\`` → `return actionLabel` |

### Notes on item 2 (line 2256-2260)
The if/else block is: if cascadeChanged → toast, else → toast. Delete the `toast.success` on line 2257 but keep the else branch toast. The if block becomes empty so collapse it: just keep the else branch's `toast.info` unconditionally, or remove the entire if/else and keep only the else toast. Actually per the request, only line 2257 is deleted — so the if block body becomes empty. I'll remove the entire if/else and keep only the else toast.

### Notes on item 5 (FindMyHotelsDrawer)
Delete line 113 (`toast.success` for credits used). Keep the free-cap toast on line 111 as well? The request says delete line 112 which maps to the credits-used toast. I'll delete only the paid toast (line 113) and keep the free one (line 111). Actually re-reading: the request says delete the line `toast.success('Finding your perfect hotels (${result.spent ?? creditCost} credits used)')` — that's only the paid branch. I'll also clean up the if/else to just keep the free branch toast or remove both. The request specifically targets one line — I'll delete just that line and adjust the if/else.

