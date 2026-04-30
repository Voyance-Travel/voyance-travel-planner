Yes — you’re right. We control the storage, so the system should not keep rediscovering meaning from a blob every time. The current implementation improved the day checker, but it still feeds that checker from mixed sources like `metadata.userAnchors`, `metadata.userIntents`, `metadata.additionalNotes`, `mustDoActivities`, and `perDayActivities`. That means the Day Brief exists, but its inputs are still partly blob-shaped.

Plan: build a structured, day-scoped intent intake layer so every user mention becomes its own row before generation or assistant actions use it.

```text
Four entry points
  1. Start / Chat Planner extraction
  2. Fine-Tune notes
  3. Manual paste / manual add / edits
  4. Itinerary assistant chat
        |
        v
Structured day-intent rows
  one row per activity / restaurant / avoid / constraint / transport / note
        |
        v
Day Brief builder
  grouped by trip_id + day_number + date
        |
        v
Prompt + post-save checker + UI visibility
```

## What I’ll change

### 1. Add a real normalized table for day-scoped user intent
Create a new table, separate from the existing generic `trip_intents`, because `trip_intents` only stores `intent_type` + `intent_value` and cannot reliably answer: what day, what time, what kind of thing, which entry point, is it locked, and has it been fulfilled?

Proposed table shape:

```text
trip_day_intents
- id
- trip_id
- user_id
- day_number
- date
- destination
- source_entry_point
  chat_planner | fine_tune | manual_paste | manual_add | assistant_chat | pin | edit
- intent_kind
  restaurant | dinner | lunch | breakfast | activity | event | transport | avoid | constraint | note
- title
- raw_text
- start_time
- end_time
- priority
  must | should | avoid
- locked
- locked_source
- status
  active | fulfilled | superseded | dismissed
- fulfilled_activity_id
- metadata
- created_at / updated_at
```

RLS will match trip ownership/collaboration rules. This becomes the storage contract for user requirements.

### 2. Add a shared normalizer/parser used by all four entry points
Create shared functions that convert messy input into structured rows:

- day-by-day pasted plans become multiple rows, not one `perDayActivities` string
- “Day 3 dinner at Belcanto 7:30” becomes one dinner row for Day 3
- “avoid seafood Friday” becomes one avoid row for that date/day
- “need transport from US Open to JFK” becomes one transport/constraint row
- “ramen tonight” in assistant chat becomes a dinner row for the current day

The key shift: we can still preserve the raw text for auditing, but raw text is no longer the working source of truth.

### 3. Wire Start / Chat Planner extraction into structured storage
Today the chat planner returns useful fields, but much of it still lands as `mustDoActivities`, `additionalNotes`, `userConstraints`, and `perDayActivities` blobs/arrays inside metadata.

I’ll keep those for backward compatibility, but also immediately write normalized `trip_day_intents` rows after trip creation. This means every extracted venue, restaurant, event, avoid, transport need, or time block has a day-scoped row.

### 4. Wire Fine-Tune notes into the same table
Currently Fine-Tune notes are parsed at generation time. That’s too late and too lossy.

I’ll add a persist step so Fine-Tune notes are parsed once into day-intent rows when generation starts or when the trip is updated. The original note remains available, but the planner reads the structured rows.

### 5. Wire manual paste, manual add, pins, and edits into the same table
Manual/pasted activities already become locked anchors in metadata and itinerary rows. I’ll also write each one into `trip_day_intents` with `locked=true`, so the Day Brief can treat them consistently with assistant and fine-tune requests.

For manual additions/edits applied through the itinerary UI or assistant action executor, I’ll ensure the backend save path extracts any locked/user-requested activities into day-intent rows as part of normalization.

### 6. Change the Day Brief builder to read structured rows first
Update `day-ledger.ts`, `compile-prompt.ts`, and `action-save-itinerary.ts` so the Day Brief gathers `userIntent` from `trip_day_intents` grouped by day.

Fallback behavior:
- read old metadata fields only if structured rows are absent
- optionally backfill rows from old metadata during save/generation
- do not break existing trips

This makes the day checker deterministic: it no longer has to guess from blobs unless it is handling legacy data.

### 7. Persist day briefs correctly into normalized day rows
The database already has `itinerary_days.day_brief`, but current sync does not appear to populate it. I’ll fix the sync so each `itinerary_days` row stores the exact Day Brief snapshot used/validated for that day.

That gives us a visible audit trail:

```text
Day 4 knew:
- user required ramen dinner
- avoid seafood
- already did Belém Tower
- tomorrow has a Michelin dinner
- museum X closed today
```

### 8. Add fulfillment/status tracking
After generation/save, when the checker sees that an intent is present in an activity, mark that intent as fulfilled and link it where possible. If the AI misses a must-intent and the checker inserts a placeholder, keep the intent active and surface it clearly.

This prevents the system from repeatedly asking, “Did we remember this?” because the database knows whether each request was fulfilled.

### 9. Add regression tests around the exact failure mode
Add tests for:

- multiple restaurants mentioned across multiple days are stored as separate rows
- Fine-Tune “Day 2 ramen dinner” becomes a Day 2 dinner intent
- assistant “ramen tonight” stores one row and does not trigger replanning
- Day Brief reads structured rows and renders them in `USER REQUIRED`
- save checker inserts placeholder only when an active must-intent is missing
- legacy metadata fallback still works

## Expected outcome

After this, “Jess told us she wants X dinner on Day 3” will not live as a buried sentence in a metadata blob. It will be a real row:

```text
trip_id: ...
day_number: 3
intent_kind: dinner
title: X
priority: must
source_entry_point: chat_planner
status: active/fulfilled
```

Then the generator, assistant, checker, and UI can all use the same source of truth instead of each pathway trying to parse the same blob differently.

## Important principle

This does not replace the Day Brief. It fixes the Day Brief’s input layer.

The Day Brief should remain the per-day working packet. But the raw material feeding it should be normalized structured intent rows, not a collection of ad hoc metadata fields.