
# Fix: DNA Trait Adjustments Not Persisting After Preference Changes

## Problem

When users adjust their Travel DNA traits using the sliders in the profile, the adjustments are **disappearing** after being saved. This happens because:

1. **Missing Override Passthrough**: The `recalculateDNAFromPreferences()` function does NOT pass `existingOverrides` to the edge function
2. **No Cache Invalidation**: The React Query cache for profile/DNA data is not being invalidated after DNA recalculation

### Current Flow (Broken)

```text
User adjusts trait slider → Saved to profiles.travel_dna_overrides ✅
User changes preference → triggers DNA recalculation
recalculateDNAFromPreferences() called WITHOUT existingOverrides ❌
Edge function ignores user's manual adjustments
New DNA saved → overwrites previous values
User's adjustments "disappear"
```

---

## Solution

### 1. Pass Existing Overrides to Edge Function

Update `recalculateDNAFromPreferences()` to:
1. Fetch `travel_dna_overrides` from `profiles` table before recalculating
2. Pass them to `calculateTravelDNAAdvanced()` as the third parameter

### 2. Invalidate React Query Cache After Recalculation

After DNA is saved, invalidate the relevant query keys so the UI refreshes with the new data.

---

## Implementation Details

### File: `src/utils/quizMapping.ts`

**Current code (line 958-978):**
```typescript
export async function recalculateDNAFromPreferences(
  userId: string
): Promise<{ success: boolean; dna: TravelDNAPayload | null }> {
  try {
    // 1. Fetch current preferences
    const preferences = await getUserPreferences(userId);
    // ...
    
    // 3. Recalculate DNA via backend
    let dna: TravelDNAPayload;
    try {
      dna = await calculateTravelDNAAdvanced(answers, userId);  // ❌ Missing overrides!
    }
```

**Updated code:**
```typescript
export async function recalculateDNAFromPreferences(
  userId: string
): Promise<{ success: boolean; dna: TravelDNAPayload | null }> {
  try {
    // 1. Fetch current preferences AND existing overrides in parallel
    const [preferences, overridesResult] = await Promise.all([
      getUserPreferences(userId),
      supabase
        .from('profiles')
        .select('travel_dna_overrides')
        .eq('id', userId)
        .maybeSingle()
    ]);
    
    const existingOverrides = overridesResult.data?.travel_dna_overrides as Record<string, number> | null;
    
    if (existingOverrides && Object.keys(existingOverrides).length > 0) {
      console.log('[DNA Recalc] Preserving existing overrides:', Object.keys(existingOverrides));
    }
    // ...
    
    // 3. Recalculate DNA via backend WITH overrides
    let dna: TravelDNAPayload;
    try {
      dna = await calculateTravelDNAAdvanced(answers, userId, existingOverrides);  // ✅ Pass overrides!
    }
```

### File: `src/components/profile/EditorialPreferencesView.tsx`

**Add cache invalidation after DNA recalculation:**

Import `useQueryClient` from React Query and invalidate relevant queries after DNA update:

```typescript
import { useQueryClient } from '@tanstack/react-query';

// Inside component:
const queryClient = useQueryClient();

// In scheduleDNARecalc callback:
const result = await recalculateDNAFromPreferences(user.id);
if (result.success) {
  // Invalidate DNA-related queries so UI refreshes
  queryClient.invalidateQueries({ queryKey: ['travel-dna'] });
  queryClient.invalidateQueries({ queryKey: ['profile'] });
  queryClient.invalidateQueries({ queryKey: ['preference-completion'] });
  // ... toast success
}
```

Also update `handleRecalculateDNA` with the same invalidation.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/quizMapping.ts` | Fetch `travel_dna_overrides` and pass to `calculateTravelDNAAdvanced()` |
| `src/components/profile/EditorialPreferencesView.tsx` | Add React Query cache invalidation after DNA recalculation |

---

## Technical Details

### Why This Fixes the Issue

1. **Override Preservation**: By fetching and passing `existingOverrides`, the edge function will blend them with computed scores (70% computed, 30% override influence per line 1986 in edge function)

2. **UI Refresh**: Invalidating React Query cache ensures components fetching DNA data will refetch fresh data from the database

### Expected Flow After Fix

```text
User adjusts trait slider → Saved to profiles.travel_dna_overrides ✅
User changes preference → triggers DNA recalculation
recalculateDNAFromPreferences() fetches existingOverrides first ✅
Edge function blends overrides with new computed scores ✅
New DNA saved (with override influence)
React Query cache invalidated → UI refreshes ✅
User's adjustments are preserved in the final result ✅
```

---

## Testing Verification

After implementation:
1. Go to Profile → Adjust trait sliders (e.g., set Planning to +5)
2. Save the adjustments
3. Go to Preferences tab → Change travel pace
4. Verify toast shows "Updating your Travel DNA..."
5. Return to DNA section → Verify Planning adjustment is still visible
6. Verify the archetype reflects the blended scores
