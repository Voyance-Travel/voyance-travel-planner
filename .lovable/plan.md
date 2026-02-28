
# Fix All 2025/Past Date References Across the Platform

## Problem
Multiple files across the codebase still use `new Date().toISOString().split('T')[0]` (UTC-based, can be off by a day) or contain hardcoded 2024/2025 dates in prompts, placeholders, and examples. Since it is now 2026, any reference to 2025 in user-facing flows is stale.

## Changes

### 1. Update placeholder text to say "2026"
- **`src/components/planner/steps/TripSetup.tsx`** -- Change `"Summer Adventure 2024"` placeholder to `"Summer Adventure 2026"`
- **`src/lib/copy.ts`** -- Change `"Summer Adventure 2024"` to `"Summer Adventure 2026"`

### 2. Replace remaining `toISOString().split('T')[0]` with `getLocalToday()` in client code
These files use the UTC-based pattern for "today" and risk off-by-one date bugs:

- **`src/services/userAPI.ts`** (line 294) -- `new Date().toISOString().split('T')[0]` for filtering trips
- **`src/contexts/TripPlannerContext.tsx`** (lines 275-276, 340-341) -- fallback dates for trip creation
- **`src/services/weatherAPI.ts`** (line 54) -- weather API start date
- **`src/pages/planner/PlannerFlight.tsx`** (line 256) -- default departure date fallback
- **`src/hooks/useBulkUnlock.ts`** (line 97) -- date calculation for itinerary generation
- **`src/types/multiCity.ts`** (lines 177-179) -- multi-city date calculations

Each will import and use `getLocalToday()` or `parseLocalDate()` as appropriate.

### 3. Fix edge function prompts with hardcoded years
- **`supabase/functions/generate-trip-preview/index.ts`** (line 174) -- Example JSON has `"date": "2024-03-15"`. Change to a dynamic or generic placeholder like `"YYYY-MM-DD"` or use the actual trip dates from the request.
- **`supabase/functions/generate-quick-preview/index.ts`** (line 294) -- Prompt asks about `"2024/2025"` entry requirements. Change to dynamically reference the current year.

### 4. Update static content references
- **`src/components/home/Testimonials.tsx`** (line 6) -- `"Anonymous beta user, 2025"` to `"Anonymous beta user, 2026"`
- **`src/data/guides.ts`** -- The "Best Time to Book for 2025" guide: update title, slug, and body text references to 2026
- **`src/utils/pressKitGenerator.ts`** -- `"Press Kit 2025"` to `"Press Kit 2026"`

### 5. Fix `addDays` utility in dateUtils.ts
The `addDays` function (line 79) still uses `toISOString().split('T')[0]` which can produce wrong dates near midnight. Update it to use local date formatting consistent with `getLocalToday()`.

## Technical Details

All client-side files will import from `@/utils/dateUtils`:
```typescript
import { getLocalToday, parseLocalDate } from '@/utils/dateUtils';
```

Edge functions will compute the current year dynamically:
```typescript
const currentYear = new Date().getFullYear();
```

No database changes are needed. This is purely a code sweep to eliminate stale year references and UTC date bugs.
