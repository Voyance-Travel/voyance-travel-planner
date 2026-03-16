

## Fix: False "Sorry, something went wrong" error in Direct mode

### Root Cause

When the AI returns tool calls (actions) without accompanying text, `response.message` is an empty string `""`. The frontend check at line 277:

```typescript
content: (response.message && !response.message.trim().startsWith('{') && !response.message.trim().startsWith('['))
  ? response.message
  : 'Sorry, something went wrong. Please try again.',
```

treats empty string as falsy → shows the error message. Meanwhile, the actions auto-apply successfully at lines 294-303, so the user sees both "Sorry, something went wrong" and "Applying changes..." simultaneously.

### Fix

**File: `src/components/itinerary/ItineraryAssistant.tsx`** (lines ~274-286)

Replace the assistant message content logic:

1. If `response.message` has real text (not JSON), use it.
2. If `response.message` is empty/missing **but actions exist**, show a neutral message like `"Here's what I'll change:"` instead of an error.
3. Only show the error fallback if there's no message AND no actions (a genuinely broken response).

```typescript
const hasActions = response.actions?.length > 0;
const messageText = response.message?.trim() || '';
const isJsonLeak = messageText.startsWith('{') || messageText.startsWith('[');

const assistantContent = (messageText && !isJsonLeak)
  ? response.message
  : hasActions
    ? "Here's what I'll change:"
    : 'Sorry, something went wrong. Please try again.';
```

This is a one-line-area fix in one file. No backend changes needed — the edge function already handles this correctly server-side.

