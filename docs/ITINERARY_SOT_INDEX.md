# Itinerary System - Source of Truth (SOT) Documentation

**Version:** 2.0
**Last Updated:** January 2025

---

## 📚 What is a Source of Truth (SOT)?

A **Source of Truth (SOT)** is the **canonical, definitive reference** for a specific part of the codebase. It represents:

- ✅ **The correct way** to implement a feature
- ✅ **The standard types** everyone should use
- ✅ **The approved API patterns** for consistency
- ✅ **The single place** to look for guidance

**Rule:** If you need to work with itineraries, **start here**. Don't create new types, services, or hooks—use these SOT files.

---

## 🗂️ SOT Files for Itinerary System

### 1. **Types SOT** - `src/types/itinerary.ts`

**What it contains:**

- All TypeScript interfaces for itineraries
- API request/response types
- UI state types
- Helper types and utilities
- Type guards for runtime validation
- Constants (labels, icons, defaults)

**When to use:**

- Whenever you need to type an itinerary object
- When building components that display itinerary data
- When making API calls to itinerary endpoints
- When working with activity, day, or preference types

**Example:**

```typescript
import type {
  Itinerary,
  DayItinerary,
  Activity,
  GenerateItineraryRequest,
} from '@/types/itinerary';

function MyComponent({ itinerary }: { itinerary: Itinerary }) {
  // TypeScript will validate that itinerary has the correct structure
  return <div>{itinerary.days.length} days</div>;
}
```

---

### 2. **API Service SOT** - `src/services/itinerary.sot.ts`

**What it contains:**

- All API functions for itinerary operations
- Endpoint constants (single source of truth for URLs)
- Error handling and normalization
- Helper functions (retry logic, get-or-generate, etc.)
- Activity update, lock, reorder functions

**When to use:**

- Whenever you need to call an itinerary API endpoint
- When generating, fetching, or updating itineraries
- When regenerating days or getting activity alternatives
- When implementing error handling for itinerary operations

**Example:**

```typescript
import itineraryAPI from '@/services/itinerary.sot';

async function generateMyItinerary(tripId: string) {
  try {
    const result = await itineraryAPI.generateItinerary(tripId, {
      preferences: { pace: 'moderate' },
    });
    console.log('Generated:', result.itinerary);
  } catch (error) {
    console.error('Failed:', error.message);
  }
}
```

**⚠️ Important:** Always use `itineraryAPI` from this file, not direct `api.post()` calls. This ensures consistency and proper error handling.

---

### 3. **React Hooks SOT** - `src/hooks/useItinerary.sot.ts` (Optional - requires React Query)

**Status:** ⏸️ Not yet created - requires `@tanstack/react-query` installation

**What it will contain:**

- React hooks for itinerary state management
- React Query integration (queries, mutations)
- Query keys (for cache invalidation)
- Advanced hooks (auto-generate, activity updates, reordering)
- Utility hooks (budget breakdown, statistics, validation)

**To enable:**

```bash
npm install @tanstack/react-query
```

Then create this file following the patterns in the Complete Guide.

**Note:** For now, use `itineraryAPI` directly in your components. Once React Query is installed, we can create the hooks SOT for better state management and caching.

---

## 🎯 How to Use These SOTs

### Scenario 1: "I'm building a new itinerary viewer component"

**Steps:**

1. Import types from `src/types/itinerary.ts`
   ```typescript
   import type { Itinerary, DayItinerary } from '@/types/itinerary';
   ```
2. Use the `useItinerary` hook from `src/hooks/useItinerary.sot.ts`
   ```typescript
   const { data, isLoading } = useItinerary(tripId);
   ```
3. Render the itinerary using the typed data

**Don't:**

- ❌ Create your own `Itinerary` type
- ❌ Call `api.get('/api/v1/trips/:id/itinerary')` directly
- ❌ Manage loading/error state manually

---

### Scenario 2: "I need to generate an itinerary after booking"

**Steps:**

1. Import the hook:
   ```typescript
   import { useGenerateItinerary } from '@/hooks/useItinerary.sot';
   ```
2. Use it in your component:

   ```typescript
   const { mutate: generate, isPending } = useGenerateItinerary();

   const handleBookingComplete = () => {
     generate({
       tripId,
       request: { preferences: { pace: 'moderate' } },
     });
   };
   ```

**Don't:**

- ❌ Call `itineraryAPI.generateItinerary()` directly in components
- ❌ Manually invalidate cache after generation

---

### Scenario 3: "I need to update a single activity (e.g., lock it)"

**Steps:**

1. Import the hook:
   ```typescript
   import { useActivityUpdate } from '@/hooks/useItinerary.sot';
   ```
2. Use it:

   ```typescript
   const { updateActivity, isUpdating } = useActivityUpdate(tripId);

   const handleLock = () => {
     updateActivity(dayNumber, activityIndex, { locked: true });
   };
   ```

**Don't:**

- ❌ Fetch the entire itinerary, modify it, and save it back
- ❌ Call `itineraryAPI.updateActivity()` directly

---

### Scenario 4: "I need to display budget breakdown"

**Steps:**

1. Import the hook:
   ```typescript
   import { useBudgetBreakdown } from '@/hooks/useItinerary.sot';
   ```
2. Use it:

   ```typescript
   const { data } = useItinerary(tripId);
   const breakdown = useBudgetBreakdown(data?.itinerary, totalBudget);

   return <BudgetChart breakdown={breakdown} />;
   ```

**Don't:**

- ❌ Manually calculate budget in every component
- ❌ Create your own budget calculation logic

---

## 📋 SOT Rules

### 1. **One Source, Many Uses**

- If itinerary logic exists in a SOT file, use it
- Don't duplicate logic in other files
- If you need additional functionality, **add it to the SOT file**

### 2. **Never Bypass the SOT**

- Don't call `api.post()` directly for itinerary endpoints
- Don't create ad-hoc types for itinerary data
- Don't write custom hooks that duplicate SOT hooks

### 3. **Propose Changes to the SOT**

- If the SOT doesn't meet your needs, **update the SOT**
- Don't work around it—improve it for everyone
- Document your changes

### 4. **Keep SOTs Synchronized**

- Types → API Service → React Hooks
- If you add a new API endpoint, add:
  1. Request/response types in `itinerary.ts`
  2. API function in `itinerary.sot.ts`
  3. React hook in `useItinerary.sot.ts` (if needed)

---

## 🔄 Workflow: Adding New Itinerary Features

### Example: "Add a feature to duplicate a day"

**Step 1: Add types** (`src/types/itinerary.ts`)

```typescript
export interface DuplicateDayRequest {
  dayNumber: number;
  insertAfter?: number;
}

export interface DuplicateDayResponse {
  success: boolean;
  newDay?: DayItinerary;
}
```

**Step 2: Add API function** (`src/services/itinerary.sot.ts`)

```typescript
const ENDPOINTS = {
  ...existing,
  DUPLICATE_DAY: (tripId: string) => `/api/v1/trips/${tripId}/itinerary/days/duplicate`,
};

export async function duplicateDay(
  tripId: string,
  request: DuplicateDayRequest
): Promise<DuplicateDayResponse> {
  const response = await api.post(ENDPOINTS.DUPLICATE_DAY(tripId), request);
  return response.data;
}

// Add to default export
const itineraryAPI = {
  ...existing,
  duplicateDay,
};
```

**Step 3: Add React hook** (`src/hooks/useItinerary.sot.ts`)

```typescript
export function useDuplicateDay(): UseMutationResult<...> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, request }) => itineraryAPI.duplicateDay(tripId, request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ITINERARY_QUERY_KEYS.detail(variables.tripId),
      });
    },
  });
}

// Add to default export
export default {
  ...existing,
  useDuplicateDay,
};
```

**Step 4: Use in component**

```typescript
import { useDuplicateDay } from '@/hooks/useItinerary.sot';

function DayCard({ tripId, dayNumber }) {
  const { mutate: duplicate, isPending } = useDuplicateDay();

  return (
    <button onClick={() => duplicate({ tripId, request: { dayNumber } })} disabled={isPending}>
      Duplicate Day
    </button>
  );
}
```

---

## 🆘 Troubleshooting

### Issue: "I can't find the function I need"

**Solution:**

1. Check all three SOT files (types, service, hooks)
2. If it doesn't exist, **add it** following the workflow above
3. Don't create a workaround—update the SOT

### Issue: "Types don't match the backend response"

**Solution:**

1. Update `src/types/itinerary.ts` to match backend contract
2. Update backend documentation if response is correct
3. Coordinate with backend team to align

### Issue: "Hook doesn't invalidate cache correctly"

**Solution:**

1. Check that you're using the correct query key from `ITINERARY_QUERY_KEYS`
2. Ensure `onSuccess` in mutation calls `queryClient.invalidateQueries()`
3. Update the hook in `useItinerary.sot.ts` if needed

### Issue: "API call fails with 500 error"

**Solution:**

1. Check backend logs (Railway, Datadog, etc.)
2. Verify request format matches backend contract
3. Check `normalizeError()` in `itinerary.sot.ts` for proper error handling

---

## 📚 Related Documentation

### User Guides

- **Quick Start:** [docs/frontend-integration/ITINERARY_QUICK_START.md](../../docs/frontend-integration/ITINERARY_QUICK_START.md)
- **Complete System Guide:** [docs/frontend-integration/ITINERARY_SYSTEM_COMPLETE_GUIDE.md](../../docs/frontend-integration/ITINERARY_SYSTEM_COMPLETE_GUIDE.md)
- **Troubleshooting:** [docs/frontend-integration/ITINERARY_TROUBLESHOOTING.md](../../docs/frontend-integration/ITINERARY_TROUBLESHOOTING.md)
- **Documentation Index:** [docs/frontend-integration/ITINERARY_DOCUMENTATION_INDEX.md](../../docs/frontend-integration/ITINERARY_DOCUMENTATION_INDEX.md)

### API Contracts

- **Backend API Specs:** [docs/api/BACKEND_API_SPECS.md](../../docs/api/BACKEND_API_SPECS.md)
- **Itinerary Contract:** [docs/api/ITINERARY_CONTRACT_v1.0.md](../../docs/api/ITINERARY_CONTRACT_v1.0.md)

### Feature-Specific SOT Documents

- **Progressive Itinerary Generation SOT:** [SOT_PROGRESSIVE_ITINERARY_GENERATION.md](./SOT_PROGRESSIVE_ITINERARY_GENERATION.md) - Complete guide for implementing the 4-step progressive generation system

---

## ✅ Checklist: Am I Using SOTs Correctly?

Before committing code that touches itineraries, verify:

- [ ] I imported types from `src/types/itinerary.ts`
- [ ] I used hooks from `src/hooks/useItinerary.sot.ts` in React components
- [ ] I used `itineraryAPI` from `src/services/itinerary.sot.ts` for API calls
- [ ] I didn't create duplicate types or functions
- [ ] I didn't bypass SOT files with direct `api.post()` calls
- [ ] If I added new functionality, I updated all three SOT files
- [ ] My code follows the patterns in the SOT files

---

## 🔗 Quick Links

| File                  | Path                                                           | Purpose                 |
| --------------------- | -------------------------------------------------------------- | ----------------------- |
| **Types SOT**         | `src/types/itinerary.ts`                                       | TypeScript interfaces   |
| **API Service SOT**   | `src/services/itinerary.sot.ts`                                | API functions           |
| **Hooks SOT**         | `src/hooks/useItinerary.sot.ts`                                | React hooks             |
| **Quick Start Guide** | `docs/frontend-integration/ITINERARY_QUICK_START.md`           | 30-min implementation   |
| **Complete Guide**    | `docs/frontend-integration/ITINERARY_SYSTEM_COMPLETE_GUIDE.md` | Comprehensive reference |
| **Troubleshooting**   | `docs/frontend-integration/ITINERARY_TROUBLESHOOTING.md`       | Debug guide             |

---

**Last Updated:** January 2025
**Maintained by:** Voyance Engineering Team
**Questions?** Ask in #frontend-integration or email frontend@voyance.com
