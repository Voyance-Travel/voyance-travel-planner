

## Fix: `userNotes is not defined` — Breaking All Itinerary Generation

### Root Cause

In `supabase/functions/generate-itinerary/index.ts`, lines 2811 and 2827 reference a variable called `userNotes` that does not exist. The correct variable is `userPreferenceText`, defined at line 2774. This is a simple typo causing a `ReferenceError` that crashes day generation on every attempt (visible in logs: Days 1, 2, and 3 all fail with "userNotes is not defined").

The error retries up to 3 times per day, wasting AI tokens each time before ultimately failing the entire trip.

### Fix

**File: `supabase/functions/generate-itinerary/index.ts`**

Two lines to change:
- **Line 2811**: `userNotes.includes(...)` → `userPreferenceText.includes(...)`
- **Line 2827**: `userNotes.includes(...)` → `userPreferenceText.includes(...)`

That's it. One variable name, two occurrences.

### Impact
- Unblocks all itinerary generation (standard and Smart Finish)
- Stops wasting tokens on retry loops that can never succeed
- The "light dining" and "budget" preference validation checks will actually work as intended

