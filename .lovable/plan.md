

## Fix: Chat auto-scrolls away from sent message

### Root cause

The auto-scroll `useEffect` (line 91-93) fires on every `messages` change using `scrollIntoView({ behavior: 'smooth' })` on a `bottomRef` div. The problem is twofold:

1. **Realtime duplicate**: After sending (optimistic update), the realtime subscription fires an INSERT event for the same message. The dedup check (line 78) prevents a duplicate entry, but `setMessages` still triggers the effect with a new array reference, causing a second scroll.
2. **ScrollArea mismatch**: `scrollIntoView` targets the `bottomRef` inside `ScrollArea`, but `ScrollArea` uses a custom viewport container. `scrollIntoView` may scroll the wrong scrollable ancestor (e.g. the page), pulling the entire view away from the chat.

### Fix

**File: `src/components/chat/TripChat.tsx`**

1. **Replace `scrollIntoView` with direct `ScrollArea` viewport scroll**: Instead of `bottomRef.current?.scrollIntoView()`, find the scroll viewport (`[data-radix-scroll-area-viewport]`) inside `scrollRef` and set its `scrollTop` to `scrollHeight`.

2. **Only auto-scroll when near the bottom** (or when the user just sent a message): Add a `justSent` ref that's set to `true` in `handleSend` and cleared after scroll. This prevents forced scrolling when receiving others' messages while the user is reading history.

```tsx
const justSentRef = useRef(false);

// In handleSend, before optimistic update:
justSentRef.current = true;

// Replace the auto-scroll useEffect:
useEffect(() => {
  const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
  if (!viewport) return;
  const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 150;
  if (justSentRef.current || isNearBottom) {
    viewport.scrollTop = viewport.scrollHeight;
    justSentRef.current = false;
  }
}, [messages]);
```

Remove `bottomRef` entirely since it's no longer needed.

