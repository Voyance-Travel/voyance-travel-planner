

## Per-Activity AI Concierge Chat

### Summary
Add a contextual AI chat to every venue-based activity card, allowing users to ask questions, get insider tips, and swap activities — all pre-loaded with full trip and activity context.

### Architecture Overview

```text
┌─────────────────────┐     ┌──────────────────────┐
│ TripActivityCard    │     │ CustomerDayCard       │
│  + ✨ concierge btn │     │  + ✨ concierge btn   │
└────────┬────────────┘     └────────┬─────────────┘
         │                           │
         ▼                           ▼
┌────────────────────────────────────────────────┐
│ ActivityConciergeSheet (new component)         │
│  - Header: venue name, time, photo             │
│  - AI opening message (auto on open)           │
│  - Quick action chips                          │
│  - Chat messages (persisted per activity ID)   │
│  - "Swap to this" buttons on alternatives      │
│  - Sheet on desktop, bottom sheet on mobile    │
└────────────────────┬───────────────────────────┘
                     │ supabase.functions.invoke
                     ▼
┌────────────────────────────────────────────────┐
│ Edge Function: activity-concierge (new)        │
│  - Receives activity + trip + surrounding ctx  │
│  - System prompt: local concierge persona      │
│  - Streaming responses via Lovable AI Gateway  │
│  - Tool calling for "suggest alternatives"     │
└────────────────────────────────────────────────┘
```

### New Files

#### 1. `src/components/itinerary/ActivityConciergeSheet.tsx`
The main UI component — a `Sheet` (right side desktop, bottom sheet mobile via `useIsMobile`).

**Props:**
```typescript
interface ActivityConciergeSheetProps {
  open: boolean;
  onClose: () => void;
  activity: TripActivity | ItineraryActivity;
  dayDate: string;
  dayTitle?: string;
  previousActivity?: string;
  nextActivity?: string;
  destination: string;
  tripType?: string;
  totalDays?: number;
  travelers?: number;
  currency?: string;
  hotelName?: string;
  onActivitySwap?: (activityId: string, newActivity: any) => void;
}
```

**Behavior:**
- On open, auto-sends an opening request (no user input needed) to get proactive insights
- Shows streaming response token-by-token
- Renders quick action chips based on category (DINING vs EXPLORE vs STAY etc.)
- Chat history stored in component state, keyed by activity ID via a `useRef<Map<string, Message[]>>`
- "Suggest an alternative" responses include structured swap buttons
- Tapping "Swap to this" calls `onActivitySwap`, shows undo toast

**Filtering logic** — hide the concierge button when:
- Category is `TRANSPORT`, `TRAVEL`, `LOGISTICS`, `TRANSIT`
- Title contains "Return to Your Hotel", "Freshen Up", "Arrival Flight", "Departure"

#### 2. `supabase/functions/activity-concierge/index.ts`
New edge function with streaming SSE support.

**Input:** `{ messages, activityContext, tripContext, surroundingContext }`

**System prompt** includes all the context (venue, time, day of week, trip type, budget, previous/next activity). Instructs the AI to be a knowledgeable local concierge. Uses `google/gemini-3-flash-preview` via Lovable AI Gateway.

**Tool calling** for structured alternative suggestions:
```typescript
tools: [{
  type: "function",
  function: {
    name: "suggest_alternatives",
    description: "Suggest 2-3 real alternative venues",
    parameters: {
      type: "object",
      properties: {
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: { type: "string" },
              price_per_person: { type: "number" },
              reason: { type: "string" }
            }
          }
        }
      }
    }
  }
}]
```

Streams text responses; returns structured JSON for alternatives.

#### 3. `src/hooks/useActivityConcierge.ts`
Custom hook managing:
- Per-activity chat history (Map keyed by activity ID)
- Streaming fetch to the edge function
- Opening message generation on first open
- Message state management
- History reset when activity ID changes (swap scenario)

### Modified Files

#### 4. `src/components/planner/TripActivityCard.tsx`
- Add `onOpenConcierge?: (activity: TripActivity) => void` prop
- Add a sparkle (✨) icon button in the actions area (near lock toggle), filtered by category
- The parent controls the sheet open state

#### 5. `src/components/planner/CustomerDayCard.tsx`
- Add sparkle button to each activity row (in the hover actions area, next to Search and Lock buttons)
- Manage `ActivityConciergeSheet` open state
- Pass surrounding activity context (previous/next titles) from the day's activity array

#### 6. `src/components/planner/DayTimeline.tsx`
- Pass concierge-related props through to `TripActivityCard`

### Quick Action Chips by Category

| Category | Chips |
|----------|-------|
| DINING | "What should I order?" · "Do I need a reservation?" · "What's the dress code?" · "Suggest an alternative" |
| EXPLORE/CULTURE | "What should I not miss?" · "How do I skip the line?" · "What's nearby after?" · "Suggest an alternative" |
| STAY | "Any insider tips?" · "What's near the hotel?" · "Best room to request?" · "Suggest an alternative" |
| ACTIVITY/WELLNESS | "What should I order?" · "What's the vibe like?" · "Do I need a reservation?" · "Suggest an alternative" |

### Swap Flow
1. User taps "Suggest an alternative" chip or types it
2. AI returns structured alternatives via tool calling
3. Each alternative renders with a "Swap to this" button
4. Tapping calls `onActivitySwap(activityId, newActivityData)`
5. Sonner toast with "Undo" action appears for 10 seconds
6. Chat history for that activity ID resets (new venue = new conversation)

### What We're NOT Changing
- Global Voyance chat (bottom-right bubble) — untouched
- Existing "Why this?" / ExplainableActivity — stays as-is
- ActivityAlternativesDrawer — remains for the Search button flow
- No database tables needed — chat is session-only per the requirement

