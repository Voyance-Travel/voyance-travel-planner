

## Fix: "Add Flight" from Day 1 falls back to Flights tab instead of opening the flight dialog

### Root cause

The `ArrivalGamePlan` component on Day 1 uses `onAddFlightInline` which does:
```typescript
const btn = document.querySelector('[data-add-flight-trigger]') as HTMLButtonElement;
if (btn) btn.click(); else setActiveTab('details');
```

The `[data-add-flight-trigger]` button only exists inside a `<div className="hidden">` within the **Flights tab** content (line 6239). When the user is on the **Itinerary tab**, that DOM element isn't rendered (tab content is conditionally shown), so `querySelector` returns null and the fallback `setActiveTab('details')` fires — navigating away to the Flights tab without opening any dialog.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

1. **Add a state variable** to control the flight-add dialog from anywhere:
   ```typescript
   const [addFlightDialogOpen, setAddFlightDialogOpen] = useState(false);
   ```

2. **Update all `onAddFlightInline` callbacks** (lines ~5696, 5713, 5741) to set this state instead of using fragile DOM querying:
   ```typescript
   onAddFlightInline={() => setAddFlightDialogOpen(true)}
   ```

3. **Render an `AddFlightInline` instance outside the tab content** (at the component root level, alongside other modals) so it's always available regardless of active tab. Pass `addFlightDialogOpen` and `setAddFlightDialogOpen` to control its visibility.

4. **Keep the existing hidden trigger in the Flights tab** for the empty-state CTA there (line 6226), which works fine since it's already on the right tab.

This ensures clicking "Add Flight" from Day 1's ArrivalGamePlan opens the flight dialog inline without navigating away.

