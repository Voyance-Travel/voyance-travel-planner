## Diagnosis

The core issue is that **Just Tell Us captures specific details, but only some of them become hard locks**. Several parts of the flow still treat user specifics as suggestions, and later generation/repair steps can overwrite them.

What I found:

1. **Extraction is prompt-based and fragile**
   - `chat-trip-planner` asks the AI to fill `mustDoActivities`, `userConstraints`, and `perDayActivities`.
   - If the AI extracts a specific restaurant/activity only into `mustDoActivities`, it is handled as a must-do prompt, not a guaranteed locked card.

2. **The confirmation UI hides most of the actual detail**
   - `TripConfirmCard` shows a summary and “Locked days: N days captured,” but not the actual per-day locked items.
   - So the user can confirm without seeing whether the system truly captured the specifics correctly.

3. **`perDayActivities` is the only route that creates immutable locked cards**
   - `compile-prompt.ts` parses `metadata.perDayActivities` into `lockedCards`.
   - Those locked cards are later merged back into generated activities and protected from overlap/removal.
   - But if a user says specifics without clean day/time formatting, those items may stay in `mustDoActivities` only and can be replaced, moved, or softened.

4. **Locked card persistence has a flag mismatch**
   - Generated locked cards are marked `locked: true`, but `persist-day.ts` only saves `is_locked: act.isLocked || false`.
   - That means Just Tell Us locked cards can be saved to the normalized activities table as not locked. This weakens later protection/regeneration behavior.

5. **Final cleanup happens after persistence**
   - The flow persists the day around `action-generate-day.ts` line ~1240, then runs the final meal guard and departure cleanup after that.
   - So final changes may exist in the JSON response but not be reflected in normalized persisted rows, and post-persist cleanup can still remove things without a final lock-integrity pass.

6. **Transport selector defaults to flight in the UI**
   - Even when extraction includes `transportFromPrevious`, `TripChatPlanner` initializes all inter-city transports to `flight`, which can override the extracted train/bus/car/ferry intent unless the user manually changes it.

## Plan

### 1. Make “specific user input” become locked anchors by default
Update the Just Tell Us extraction/persistence path so anything the user specifically names is converted into structured lock data, not just prompt text.

- Add a deterministic normalization helper for chat-extracted details.
- Inputs:
  - `details.perDayActivities`
  - `details.mustDoActivities`
  - `details.userConstraints`
- Output:
  - expanded `perDayActivities` whenever day references exist
  - a new `lockedUserRequests` metadata array for named venues/events without a clear day

Behavior:
- If the user says “Day 2 dinner at X,” that becomes a locked Day 2 item.
- If the user says “we must visit pandas,” that becomes a mandatory anchor, not a replaceable suggestion.
- If no day/time is known, it remains unscheduled but marked as user-specified and must be placed once.

### 2. Strengthen the backend prompt compiler to consume request-level per-day data
In `compile-prompt.ts`, currently `perDayActivities` is read from trip metadata only.

Change it to prefer:
1. `params.perDayActivities`
2. then `metadata.perDayActivities`

This makes the day-generation call resilient even if metadata shape or frontend casting is imperfect.

### 3. Fix locked-card persistence
In `persist-day.ts`, save an activity as locked if either flag is true:

```ts
is_locked: act.isLocked || act.locked || false
```

Also preserve `lockedSource`/lock metadata in the activity payload if the schema supports metadata-like fields; if not, keep it in itinerary JSON and use `is_locked` for database protection.

### 4. Add a final post-cleanup lock integrity pass
Move or repeat the lock verification after all late guards:

- meal final guard
- terminal cleanup
- placeholder dining cleanup
- departure-buffer cleanup

This ensures locked user-provided cards cannot be removed by final cleanup. If a final guard creates a conflict, the AI-generated/fallback activity should be removed, not the user’s locked item.

### 5. Persist only after the final itinerary shape is complete
Ensure final normalized activities are persisted after all cleanup and lock verification. The database should reflect the exact itinerary returned to the UI.

This fixes the “it showed one thing / saved another thing” class of overwrite bugs.

### 6. Respect extracted inter-city transport in the confirmation UI
In `TripChatPlanner`, initialize `cityTransports` from extracted city data first:

- `details.cities[i + 1].transportFromPrevious`
- fallback to `details.cityTransports[i]`
- only default to `flight` when nothing was specified

This prevents “I said train, but the city breakdown defaults to flight.”

### 7. Make the confirmation card show what is actually locked
Update `TripConfirmCard` to show a compact “Captured specifics” section:

- per-day locked items, if present
- must-do anchors, if present
- transport modes between cities

This lets the user catch extraction misses before generation.

### 8. Add defensive tests/fixtures for Just Tell Us preservation
Add focused tests or lightweight fixtures for:

- Day-specific restaurant stays on the correct day
- Time-specific event keeps exact time
- Multi-city train remains train in confirm and persistence
- Locked cards persist with `is_locked = true`
- Final cleanup does not remove locked items

## Files to update

- `src/components/planner/TripChatPlanner.tsx`
- `src/components/planner/TripConfirmCard.tsx`
- `src/pages/Start.tsx`
- `src/utils/buildPerDayActivitiesFromMustDo.ts` or a new shared chat-intent normalizer
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/pipeline/persist-day.ts`

No database migration is expected unless we decide to add a dedicated lock metadata column. The main fix is to treat existing user-specific data as immutable throughout the current pipeline.