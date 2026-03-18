

## Fix: Edit Time Modal X Button Triggers Submit Instead of Cancel

### Root Cause

Line 10660:
```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
```

The `Dialog` component's `onOpenChange` fires when the dialog state changes — including when the X button is clicked. This calls `onClose`, which is `() => setTimeEditModal(null)`. That part is correct.

However, the real issue is that `onOpenChange` receives a boolean (`open`). When the X is clicked, it calls `onClose(false)`. Since `onClose` is `() => setTimeEditModal(null)`, the boolean is ignored and the modal closes without saving — which is correct behavior.

Let me re-examine. The bug report says clicking X **triggers the schedule shift**. This means `onSave` is somehow being called. Let me look more carefully at the `handleUpdateActivityTime` flow — specifically, the `pendingCascade` state. When `handleUpdateActivityTime` detects overflow, it sets `pendingCascade` and returns without closing the modal. The cascade confirmation dialog then appears. If the user clicks X on the **TimeEditModal** while `pendingCascade` is set, the modal closes via `setTimeEditModal(null)`, but `pendingCascade` remains set, and the cascade confirmation dialog (which is a separate dialog) stays open and can auto-confirm.

Actually, the more likely issue: the `onOpenChange` on the `Dialog` fires `onClose` which only clears the modal state. But the cascade confirmation dialog at lines 6776-6785 checks `pendingCascade` independently. The flow is:

1. User changes time to a large shift → clicks Save → `handleUpdateActivityTime` sets `pendingCascade` and does NOT close the modal
2. User sees cascade confirmation appear
3. User clicks X on the TimeEditModal → `setTimeEditModal(null)` → modal closes
4. But `pendingCascade` is still set → the cascade confirmation dialog remains visible
5. Or: the `onClose` handler on the cascade dialog auto-applies

Let me check the cascade confirmation dialog handling.

Looking at lines 6780-6785:
```tsx
onClose={() => setTimeEditModal(null)}
onSave={(startTime, endTime, cascade) => {
  if (timeEditModal) {
    handleUpdateActivityTime(...)
  }
}}
```

And `handleUpdateActivityTime` (around line 4552) sets `pendingCascade` and returns. The TimeEditModal stays open. The cascade dialog is separate. When the user clicks X on the Dialog component wrapping TimeEditModal, `onOpenChange` fires `onClose` = `setTimeEditModal(null)`. But `pendingCascade` is still active.

The actual problem: the cascade confirmation dialog's "Cancel" should also clear `pendingCascade`. And closing the TimeEditModal should clear `pendingCascade` too.

### Fix — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`**

Update the `onClose` handler for the TimeEditModal to also clear `pendingCascade`:

```tsx
// Line 10660 - change onOpenChange to also clear pending cascade
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
```

And in the parent, change the `onClose` prop:
```tsx
// Line 6780
onClose={() => {
  setTimeEditModal(null);
  setPendingCascade(null);  // Clear any pending cascade when X is clicked
}}
```

This ensures clicking X discards both the time edit AND any pending cascade confirmation, preventing the cascade from being applied after the modal is dismissed.

