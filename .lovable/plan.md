

## Fix: Approve Mode "Apply" Shows "Declined" + Confusing UX Labels

### Two issues identified

**Issue 1: "Apply" click results in "Declined" status**

The `handleActionApply` function (line 345) calls `executeAction`, and on line 387, maps the result:
```typescript
status: result.success ? 'applied' : 'declined'
```

If the action execution fails for any reason (edge function error, credit issue, network timeout), the catch block (line 520-530) also sets status to `'declined'`. So clicking "Apply" shows "Declined" whenever the underlying action fails — but using the word "Declined" is misleading. "Declined" implies the user chose not to apply it, not that it failed. The status should distinguish between user-declined and execution-failed.

Additionally, in Approve mode, actions stay `pending` and show Apply/Decline buttons. But when the user clicks Apply and it fails, it shows "Declined" with no way to retry — the buttons disappear because `isPending` is now false.

**Issue 2: Confusing "Approve" / "Direct" toggle labels**

Current UX: Toggle ON = "Approve" (actions need manual approval), Toggle OFF = "Direct" (auto-apply).

User expectation: "Approve ON" sounds like "I approve changes" — the opposite of what it does. The mental model is inverted.

### Plan

**1. Add a `'failed'` status and distinguish from user-declined** (`ItineraryAssistant.tsx` + `itineraryChatAPI.ts`)
- Add `'failed'` to the `ItineraryAction.status` type.
- In `handleActionApply`: when `result.success` is false, set status to `'failed'` instead of `'declined'`.
- In the catch block: set status to `'failed'` instead of `'declined'`.
- `'declined'` is reserved for when the user explicitly clicks the Decline/thumbs-down button.

**2. Show retry button for failed actions** (`ItineraryAssistant.tsx`)
- When status is `'failed'`, show a red "Failed" badge with a "Retry" button so the user can try again.
- Reset status back to `'pending'` on retry click, then re-run `handleActionApply`.

**3. Rename the toggle labels** (`ItineraryAssistant.tsx`)
- Change from `"Approve" / "Direct"` to `"Review first" / "Auto-apply"`.
- This makes the mental model clear: toggle ON = "let me review actions before they run."

### Files to update
- `src/services/itineraryChatAPI.ts` — add `'failed'` to `ItineraryAction['status']` union type
- `src/components/itinerary/ItineraryAssistant.tsx` — failed vs declined status logic, retry UI, label rename

