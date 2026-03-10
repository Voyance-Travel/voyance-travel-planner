

## Plan: Create Friendly Error Mapper & Wire Into Key Flows

Changes 1-3 from the request are **already implemented**. Only Change 4 remains — creating the `friendlyErrors` utility and wiring it into the most common user-facing error paths.

### New file: `src/utils/friendlyErrors.ts`
Create the `toFriendlyError()` function with the regex-based error map as specified in the request. Maps raw backend strings to branded Voyance-friendly messages.

### Wire `toFriendlyError()` into these files:

| File | What changes |
|------|-------------|
| `src/components/itinerary/EditorialItinerary.tsx` | Wrap `toast.error(err?.message)` calls for regeneration (~2882), pricing repair (~2899, 2902), and other raw error passes |
| `src/hooks/useUnlockDay.ts` | Wrap error in `throw new Error()` (~line 100) and toast messages (~117, 195) |
| `src/hooks/useUnlockTrip.ts` | Same pattern — wrap `throw` and toast calls |
| `src/components/itinerary/InlineModifier.tsx` | Wrap `toast.error(result.error)` (~211) |
| `src/components/itinerary/FindMyHotelsDrawer.tsx` | Wrap `toast.error(err?.message)` (~119) |
| `src/components/booking/BookingButton.tsx` | Wrap `toast.error(result.error)` (~81) |
| `src/hooks/usePaymentVerification.ts` | Wrap `toast.error(result.error)` (~40) |

Each file gets one import added (`import { toFriendlyError } from '@/utils/friendlyErrors'`) and the relevant `toast.error()` calls wrapped: `toast.error(toFriendlyError(rawError))`.

Only user-facing error toasts in common flows are updated. Static strings like "Please sign in to unlock days" are already friendly and left as-is.

