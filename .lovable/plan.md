

## Save AI Concierge Notes to Activity Cards

### What this does
Adds a "Save Note" button in the AI Concierge sheet that lets users pin the AI's insights directly to the activity card. Saved notes persist in the database and display on the card, so users can reference them later without re-asking the AI.

### Storage approach
Use the existing `metadata` JSONB column on `trip_activities` for activities stored in that table. For itinerary-data-based activities (the JSON blob on `trips`), store notes inside the activity object in `itinerary_data` under a new `aiNotes` field. This avoids a new table and keeps notes co-located with the activity.

### Data shape
```typescript
interface AISavedNote {
  id: string;           // uuid
  content: string;      // markdown text from AI message
  savedAt: string;      // ISO timestamp
  query?: string;       // the user question that prompted this insight
}
// Stored as activity.aiNotes: AISavedNote[]
```

### File changes

**1. `src/components/itinerary/ActivityConciergeSheet.tsx`**
- Add a new prop `onSaveNote?: (activityId: string, note: AISavedNote) => void`
- Add a small "Save" (bookmark) icon button on each assistant message bubble
- On click, call `onSaveNote` with the message content and the preceding user message as `query`
- Show a toast confirmation: "Note saved to card"
- Visually mark already-saved messages (compare content hash) with a filled bookmark icon

**2. `src/components/itinerary/EditorialItinerary.tsx`**
- Add `aiNotes` to the `EditorialActivity` interface
- Implement `handleSaveAINote` callback that:
  - Finds the activity in the current `days` state
  - Appends the note to `activity.aiNotes[]`
  - Calls the existing itinerary save/update mechanism to persist to `trips.itinerary_data`
- Pass `onSaveNote={handleSaveAINote}` to `ActivityConciergeSheet`
- In the activity card rendering (inside `ActivityCardEditorial`), show a small "AI Notes" indicator when `aiNotes.length > 0`

**3. `src/components/itinerary/EditorialItinerary.tsx` — Activity card UI**
- Inside `ActivityCardEditorial`, add a collapsible "AI Notes" section below the existing card content
- Rendered as a subtle accordion with a Sparkles icon and count badge
- Each note shows the content (rendered as markdown) and a timestamp
- Include a delete button (X) per note to remove saved notes
- Only visible when `aiNotes` array is non-empty

**4. `src/components/planner/CustomerDayCard.tsx`**
- Mirror the same `onSaveNote` prop pass-through to `ActivityConciergeSheet`
- Add note display in that card variant as well

### No database migration needed
The `itinerary_data` JSON blob already accommodates arbitrary fields per activity. Notes are stored inline as `activity.aiNotes[]` and persisted through the existing itinerary save flow.

### Technical details
- Notes are saved via the existing `optimistic_update_itinerary` RPC or direct `trips.itinerary_data` update — whichever the current save mechanism uses
- Message deduplication: compare `content` string to avoid saving the same AI response twice
- Each note gets a `crypto.randomUUID()` id for stable keys and deletion targeting

