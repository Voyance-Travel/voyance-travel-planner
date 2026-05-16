## Problem

In the Itinerary Assistant chat, "Suggested change" cards (and all action cards) clip the proposal explanation to 2 lines via `line-clamp-2`. The user sees only the first ~2 lines of text like:

> "I can replace the e-bike tour on Day 1 with a private, deep-dive walking tour of Roma Norte's architecture and hidden plazas to better fit your preference for walking and intimate experiences."

…cut off mid-sentence with no way to expand, so the user can't tell what they're approving.

## Root cause

`src/components/itinerary/ItineraryAssistant.tsx` line 764 renders the action description with:

```tsx
<p className="text-xs text-muted-foreground line-clamp-2">
  {displayInfo.description}
</p>
```

`line-clamp-2` was reasonable for compact auto-applied confirmations, but the same component now also renders `propose_change` cards where the description IS the proposal the user must read before clicking Apply.

## Fix

Remove the line clamp so the full proposal renders, and let it wrap naturally with `whitespace-pre-wrap` (mirroring the chat-message bubble above it). One line change, frontend-only, scoped to the action card description.

```tsx
<p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
  {isThisExecuting ? 'Applying changes...' : displayInfo.description}
</p>
```

Applies to all action cards (propose_change, swap, rewrite, etc.) — they all benefit from showing the full reasoning, and the action card already lives inside a `max-w-[85%]` bubble inside a scrollable `ScrollArea`, so layout stays contained.

## Files

- `src/components/itinerary/ItineraryAssistant.tsx` — replace `line-clamp-2` with `whitespace-pre-wrap break-words` on the action description `<p>` (line 764).

## Verification

Open the assistant, ask for a swap that triggers a `propose_change` card, confirm the full multi-sentence explanation renders without truncation and the Apply / decline buttons still sit cleanly below it.