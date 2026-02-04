
# Fix: Currency Bugs in Activity Swap and Add Activity Flows

## Problem Summary

Found 4 currency-related bugs that can cause incorrect cost displays:

1. **Activity Swap Missing Currency** - Most critical; breaks cost display for swapped activities
2. **Add Activity Modal Hardcodes USD** - Users adding activities manually get wrong currency
3. **Handler Fallback Hardcodes USD** - Fallback values ignore trip currency
4. **API Design Inconsistency** - Activity alternatives returns number instead of object

---

## Solution Overview

### Fix 1: `itineraryActionExecutor.ts` - Add Missing Currency Field

Update both swap locations to include `currency: 'USD'`:

| Location | Line | Current | Fixed |
|----------|------|---------|-------|
| `executeSwapAction` | ~295 | `cost: { amount: bestAlternative.estimatedCost }` | `cost: { amount: bestAlternative.estimatedCost, currency: 'USD' }` |
| `executeFilterAction` | ~590 | `cost: { amount: best.estimatedCost }` | `cost: { amount: best.estimatedCost, currency: 'USD' }` |

### Fix 2: `EditorialItinerary.tsx` - Pass tripCurrency to AddActivityModal

Update the modal to accept and use `tripCurrency`:

```typescript
// Modal props
interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (activity: Partial<EditorialActivity>) => void;
  currency: string;  // NEW
}

// In handleSubmit
cost: { amount: parseFloat(cost) || 0, currency: props.currency }

// Usage
<AddActivityModal
  ...
  currency={tripCurrency}
/>
```

### Fix 3: `EditorialItinerary.tsx` - Update handleAddActivity Fallback

Modify to use `tripCurrency` in the dependency array and fallback:

```typescript
const handleAddActivity = useCallback((dayIndex: number, activity: Partial<EditorialActivity>) => {
  const newActivity: EditorialActivity = {
    ...
    cost: activity.cost || { amount: 0, currency: tripCurrency },
    ...
  };
}, [tripCurrency]);  // Add tripCurrency dependency
```

### Fix 4: `ItineraryEditor.tsx` - Same Updates

Apply the same fixes to the ItineraryEditor component's AddActivityModal and handleAddActivity.

---

## Files to Change

| File | Changes |
|------|---------|
| `src/services/itineraryActionExecutor.ts` | Add `currency: 'USD'` to cost objects on lines ~295 and ~590 |
| `src/components/itinerary/EditorialItinerary.tsx` | Update AddActivityModal to accept currency prop; update handleAddActivity fallback |
| `src/components/itinerary/ItineraryEditor.tsx` | Same updates as EditorialItinerary |

---

## Technical Details

### itineraryActionExecutor.ts Changes

```typescript
// Line ~295 in executeSwapAction
cost: { amount: bestAlternative.estimatedCost, currency: 'USD' },

// Line ~590 in executeFilterAction  
cost: { amount: best.estimatedCost, currency: 'USD' },
```

### EditorialItinerary.tsx Changes

```typescript
// AddActivityModal - accept currency prop
interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (activity: Partial<EditorialActivity>) => void;
  currency?: string;
}

function AddActivityModal({ isOpen, onClose, onAdd, currency = 'USD' }: AddActivityModalProps) {
  // ... existing state ...
  
  const handleSubmit = () => {
    onAdd({
      title,
      description,
      category,
      startTime,
      endTime,
      cost: { amount: parseFloat(cost) || 0, currency },  // Use prop
      location: { name: locationName, address: locationAddress },
    });
    // ... reset form ...
  };
}

// handleAddActivity - use tripCurrency in fallback
const handleAddActivity = useCallback((dayIndex: number, activity: Partial<EditorialActivity>) => {
  const newActivity: EditorialActivity = {
    id: `manual-${Date.now()}`,
    title: activity.title || 'New Activity',
    description: activity.description || '',
    category: activity.category || 'activity',
    startTime: activity.startTime || '12:00',
    endTime: activity.endTime || '13:00',
    location: activity.location || { name: '', address: '' },
    cost: activity.cost || { amount: 0, currency: tripCurrency },  // Use tripCurrency
    bookingRequired: activity.bookingRequired || false,
    tags: activity.tags || [],
    isLocked: false,
  };
  // ...
}, [tripCurrency]);  // Add dependency

// Usage - pass currency
<AddActivityModal
  isOpen={!!addActivityModal}
  onClose={() => setAddActivityModal(null)}
  onAdd={(activity) => addActivityModal && handleAddActivity(addActivityModal.dayIndex, activity)}
  currency={tripCurrency}
/>
```

---

## Impact

- **Fixes broken cost display** for activities swapped via chat or filter actions
- **Consistent currency handling** when users manually add activities
- **No breaking changes** - all changes are additive with safe defaults
- **Backward compatible** - existing data without currency will fall back to USD

---

## Testing Recommendations

1. Swap an activity on a trip with non-USD display currency → verify cost shows correctly
2. Add a manual activity on a trip set to JPY display → verify cost is stored with JPY
3. Apply a filter (dietary/budget) → verify replaced activities have correct currency
4. Toggle currency display after swap → verify conversion works
