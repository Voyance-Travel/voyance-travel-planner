

# Make Chat Messages Free, Charge Only for Actions

## Philosophy
Chat messages (conversation, questions, suggestions) should be FREE. Credits should only be spent when the AI **executes a change** to the itinerary (rewrite, swap, regenerate, etc.). This makes the assistant truly conversational without financial friction.

## Changes

### 1. Remove AI_MESSAGE credit charging from `ItineraryAssistant.tsx`
- Remove the pre-flight credit check for `AI_MESSAGE` (lines 178-193)
- Remove the post-response `spendCredits.mutateAsync` call for `AI_MESSAGE` (lines 221-234)
- Remove the `useActionCap(tripId, 'ai_message')` hook since it's no longer needed for gating
- Keep all action-level credit charging intact (swap = 5cr, rewrite = 10cr, regenerate = 10cr)

### 2. Update the edge function `spend-credits` to skip AI_MESSAGE
- In `supabase/functions/spend-credits/index.ts`, make `ai_message` a no-op that returns success with 0 spent (backward compat safety net in case any other caller still sends it)

### 3. Update pricing config display
**File:** `src/config/pricing.ts`
- Change `AI_MESSAGE: 5` → `AI_MESSAGE: 0` with a comment: "Free — credits charged on action execution only"

### 4. Update chat UI to remove credit indicators on messages
**File:** `src/components/itinerary/ItineraryAssistant.tsx`
- Remove the credit cost badge/warning shown before sending messages
- Keep credit cost display on action cards (swap: 5cr, rewrite: 10cr, etc.) — those still cost credits
- Update the welcome message to mention that chatting is free but actions cost credits

### 5. Clean up related references
- `useActionCap` hook for `ai_message` can remain but will return `isFree: true` always since cost is 0
- The `TIER_FREE_CAPS` `ai_messages` field becomes irrelevant but can stay for backward compat

## What Stays Paid
- Swap activity: 5 credits
- Rewrite day: 10 credits  
- Regenerate day: 10 credits
- Adjust pacing: 5 credits
- Apply filter: 5 credits

## Result
Users can freely ask "what if I made Day 3 a food tour?", get the AI's suggestion, ask follow-ups, and only pay when they click "Apply" on an action. This encourages exploration and makes the assistant feel like a real travel companion.

## Files Changed

| File | Change |
|------|--------|
| `src/config/pricing.ts` | Set `AI_MESSAGE: 0` |
| `src/components/itinerary/ItineraryAssistant.tsx` | Remove message-level credit checks and charges, update welcome text |
| `supabase/functions/spend-credits/index.ts` | Make `ai_message` action a free no-op |

