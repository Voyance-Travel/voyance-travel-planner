

## Fix: Date headers show interval count (nights) instead of inclusive day count

### Problem
"Jul 1–5" shows as "4 days" instead of "5 days" in two components. They calculate `endDate - startDate` which gives nights (intervals), not calendar days.

### Changes

**1. `src/components/planner/ItineraryPreviewHeader.tsx` (line 32-33)**
Add `+1` to the duration calculation:
```typescript
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
```

**2. `src/components/booking/DestinationWelcome.tsx` (line 34)**
Same fix — add `+1` for inclusive day count:
```typescript
return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
```

Both align with the existing convention used in `TripStatusCards.tsx`, `useFeedbackTrigger.ts`, and the itinerary generator where `differenceInDays + 1` is the standard.

