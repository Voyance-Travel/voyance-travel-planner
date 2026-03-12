

## Bring Back the Payments Tab

The Payments tab was removed from the main tab bar array (line 3879-3884 in `EditorialItinerary.tsx`) but still exists in the mobile overflow dropdown and the rendering logic (`activeTab === 'payments'`).

### Fix

**`src/components/itinerary/EditorialItinerary.tsx` line 3882** — Add the payments tab back to the tab array, after "Budget" and before "Details":

```typescript
{ id: 'budget', label: 'Budget', fullLabel: 'Budget', icon: <Wallet className="h-4 w-4" /> },
{ id: 'payments', label: 'Payments', fullLabel: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
{ id: 'details', label: 'Details', fullLabel: 'Flights & Hotels', icon: <Plane className="h-4 w-4" /> },
```

This restores the Payments tab as a visible, clickable tab in both desktop and mobile views. The `PaymentsTab` component rendering (line 5108) and the mobile overflow entry already exist and will work as-is.

