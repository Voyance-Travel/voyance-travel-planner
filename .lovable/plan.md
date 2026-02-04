
# Auto-Recalculate Travel DNA on Preference Save

## Problem

Currently, when a user updates their Travel Style preferences (pace, interests, budget, accommodation, planning), the changes are saved to the database but the **Travel DNA is not automatically updated**. Users must manually click the "Update Travel DNA" button to see their archetype change.

This creates a disconnect where users see "Preference saved" but their displayed archetype (e.g., "Zen Seeker", "Luxury Luminary") doesn't reflect those new preferences.

## Solution Overview

Modify the `EditorialPreferencesView` component to automatically trigger DNA recalculation whenever a **DNA-affecting preference** is saved.

## Implementation Details

### Step 1: Define DNA-Affecting Fields

Create a list of preference fields that should trigger DNA recalculation:

| Field | Tab | Affects DNA? |
|-------|-----|--------------|
| `travel_pace` | Travel Style | Yes |
| `interests` | Travel Style | Yes |
| `budget_tier` | Travel Style / Budget | Yes |
| `accommodation_style` | Travel Style / Accommodation | Yes |
| `planning_preference` | Travel Style / Planning | Yes |
| `activity_level` | Travel Style | Yes |
| `travel_vibes` | Travel Style | Yes |
| `travel_companions` | Planning | Yes |
| `hotel_style` | Accommodation | Yes |
| `eco_friendly` | Values | Yes |
| `dining_style` | Food | Yes |
| `home_airport` | Flights | No |
| `seat_preference` | Flights | No |
| `dietary_restrictions` | Food | No (used for itinerary, not DNA) |
| `email_notifications` | Notifications | No |

### Step 2: Modify `updatePreference` Function

Update the function to:
1. Save the preference (existing behavior)
2. Check if the field is DNA-affecting
3. If yes, trigger DNA recalculation in the background
4. Show appropriate feedback to the user

```typescript
// DNA-affecting fields that should trigger recalculation
const DNA_AFFECTING_FIELDS = new Set([
  'travel_pace',
  'interests', 
  'budget_tier',
  'accommodation_style',
  'planning_preference',
  'activity_level',
  'travel_vibes',
  'traveler_type',
  'travel_companions',
  'hotel_style',
  'eco_friendly',
  'dining_style',
  'climate_preferences',
  'primary_goal',
]);

const updatePreference = async (field: string, value: unknown) => {
  if (!user?.id) return;
  
  setIsSaving(true);
  try {
    // 1. Save the preference
    const { error } = await supabase
      .from('user_preferences')
      .update({ [field]: value })
      .eq('user_id', user.id);
    
    if (error) throw error;
    
    setPreferences(prev => prev ? { ...prev, [field]: value } : null);
    
    // 2. Check if this field affects DNA
    if (DNA_AFFECTING_FIELDS.has(field)) {
      // Trigger DNA recalculation in the background
      recalculateDNAFromPreferences(user.id).then((result) => {
        if (result.success && result.dna) {
          toast.success('Travel DNA updated!', {
            description: result.dna.primary_archetype_display 
              ? `You're now: ${result.dna.primary_archetype_display}`
              : 'Your preferences have been applied',
          });
        }
      }).catch((err) => {
        console.error('Background DNA recalculation failed:', err);
      });
      
      toast.success('Preference saved', {
        description: 'Updating your Travel DNA...',
      });
    } else {
      toast.success('Preference saved');
    }
  } catch (error) {
    console.error('Failed to update preference:', error);
    toast.error('Failed to save');
  } finally {
    setIsSaving(false);
  }
};
```

### Step 3: Add Debouncing (Optional Optimization)

To prevent rapid-fire DNA recalculations when users quickly toggle multiple interests, add debouncing:

```typescript
import { useCallback, useRef } from 'react';

// Inside component
const dnaRecalcTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const scheduleDNARecalc = useCallback(() => {
  if (dnaRecalcTimeoutRef.current) {
    clearTimeout(dnaRecalcTimeoutRef.current);
  }
  
  dnaRecalcTimeoutRef.current = setTimeout(async () => {
    if (!user?.id) return;
    
    const result = await recalculateDNAFromPreferences(user.id);
    if (result.success && result.dna?.primary_archetype_display) {
      toast.success('Travel DNA updated!', {
        description: `You're now: ${result.dna.primary_archetype_display}`,
      });
    }
  }, 1500); // Wait 1.5s after last change
}, [user?.id]);
```

### Step 4: Update UI Feedback

Remove or modify the manual "Update Travel DNA" button since it's now automatic:

**Option A:** Remove the button entirely (since it's automatic now)

**Option B:** Keep the button but change its label to "Refresh Travel DNA" for manual override

I recommend **Option B** - keep the button as a fallback but update the copy to indicate automatic updates.

## File Changes

| File | Change |
|------|--------|
| `src/components/profile/EditorialPreferencesView.tsx` | 1. Add `DNA_AFFECTING_FIELDS` set, 2. Update `updatePreference` to trigger recalculation, 3. Add debouncing, 4. Update button label |

## Technical Considerations

1. **Debouncing**: Prevents API spam when user rapidly changes multiple preferences (e.g., toggling several interests)

2. **Background Processing**: DNA recalculation happens asynchronously so the UI doesn't freeze

3. **Graceful Degradation**: If DNA recalculation fails, the preference is still saved

4. **Toast Feedback**: Users see clear progression: "Preference saved → Updating DNA → DNA updated!"

## User Experience Flow

**Before (Current):**
1. User changes travel pace to "Relaxed"
2. Toast: "Preference saved"
3. Profile still shows old archetype
4. User must manually click "Update Travel DNA"

**After (Proposed):**
1. User changes travel pace to "Relaxed"
2. Toast: "Preference saved" with description "Updating your Travel DNA..."
3. (1.5s later) Toast: "Travel DNA updated! You're now: The Slow Traveler"
4. Profile shows new archetype automatically
