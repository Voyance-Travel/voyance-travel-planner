## What I found so far

This is not one small bad parser. The schedule is being touched by many independent timing layers, and they do not share one definition of “chronologically last,” “pre-dawn,” “arrival,” or “hotel return.”

The Istanbul trip confirms the corruption pattern:

- Persisted Day 1 has `Arrival Flight` at `03:05–05:05`.
- That same day also has a valid `Return to Hotel` at `23:44–23:59`.
- But the persisted bookend trace says the day’s “last” card is `Arrival Flight` ending `05:05`, and therefore hotel-return verification marks the day as not expecting a return.
- Why? The wrap-aware sorter treats any `00:00–05:59` time as “after midnight at the end of the day.” That is correct for a late-night bookend, but wrong for a Day 1 arrival flight. So a morning/red-eye arrival gets mistaken for the day’s terminal activity.

I also found the exact historical shape behind the “Return to hotel at 5:20 AM” class:

- A persisted hotel return row like `21:20–05:20` exists in older trip data.
- That is an impossible non-nightlife hotel return: it wraps overnight for 8 hours.
- Some layers strip pre-dawn hotel returns only when the start time is pre-dawn. They miss rows that start in the evening and end the next morning.

The deeper issue is structural:

1. There are multiple hotel-return injectors:
   - generation quality pass
   - post-meal finalization loop
   - save-time pass
   - persist-boundary verification
   - read-time UI safety net

2. There are many local time parsers with different behavior:
   - some are AM/PM-aware
   - some ignore AM/PM
   - some use `startTime`, others use `endTime`, others check aliases differently
   - some sort raw minutes, others wrap `00:00–06:00` to the next day

3. The same day may be generated more than once concurrently.
   - Istanbul has overlapping `generate-trip-day#1/#2/#3/#4` traces for the same trip.
   - That means a stale generation attempt can write older or partially repaired timing after a newer pass has already repaired it.

## Plan to fix the root, not another patch

### 1. Build one canonical timing spine
Create one shared backend timing module and one frontend mirror that owns:

- parse `HH:MM` and `H:MM AM/PM`
- format minutes back to `HH:MM`
- read canonical start/end from `startTime`, `start_time`, `time`, `endTime`, `end_time`
- classify activity timing role:
  - day-start arrival logistics
  - day-end late-night continuation
  - hotel return bookend
  - departure logistics
  - normal activity
- compute chronological sort key using role, not just clock time

Key rule: `05:05 Arrival Flight` on Day 1 is a day-start anchor, not the chronological tail. `00:55 late_nightlife_bookend` is a day-end tail.

### 2. Replace the dangerous local parsers in critical paths
Refactor only the timing-critical files first:

- backend repair pipeline
- backend save-itinerary normalization
- backend persist boundary
- backend bookend verification
- backend schedule sanity pass
- backend hotel-return injector
- frontend itinerary parser
- frontend read-time hotel-return injector
- frontend chronology/health timing helpers

This removes the current split-brain behavior where one layer says “this is the end of the day” and another says “this is the morning.”

### 3. Collapse hotel-return logic into one invariant
Keep the current user-facing behavior, but make every caller use one shared `ensureTerminalHotelReturn` algorithm.

Rules:

- Never use a Day 1 arrival flight/arrival transfer as the terminal card.
- Never inject a hotel return on departure day.
- If the final real activity ends `14:00–23:59`, append/verify a return ending no later than `23:59`.
- If the final real activity is true nightlife ending `00:00–02:30`, allow a late-night return ending no later than `02:55`.
- If the final real activity ends `02:31–13:59`, do not fabricate a “wind down overnight” return unless it is explicitly a late-night continuation.
- Existing hotel returns with `endTime < startTime` are invalid unless tagged `late_nightlife_bookend`.

This directly kills `21:20–05:20` and `23:23–07:23` hotel returns.

### 4. Add a hard write-time quarantine for impossible timing
At the single persist boundary, before save:

- Clamp or drop non-late-nightlife hotel returns that wrap past midnight.
- Strip synthetic hotel returns on departure days.
- Reject or stamp critical trace for any non-logistics Day 1 card before the real arrival availability window.
- Re-run chronology using the canonical role-aware sort key.

This ensures broken timing cannot persist even if an upstream injector misbehaves.

### 5. Add generation-run idempotency to stop stale writes
The overlapping Istanbul traces are a major red flag. Add an active generation run token:

- generation start stamps `metadata.active_generation_run_id`
- every day-generation and finalization write carries that run id
- before writing, the backend checks the run id still matches
- stale/duplicate attempts log and exit without mutating itinerary JSON

This prevents older partial runs from overwriting newer repaired timing.

### 6. Add regression fixtures from real failures
Add focused tests using the observed broken cases:

- Istanbul Day 1: `Arrival Flight 03:05–05:05` plus `Return 23:44–23:59` must treat return as terminal, not arrival flight.
- Lisbon historical: `Return to Hotel 21:20–05:20` must be clamped or removed before persist.
- Rome/Mexico City/Buenos Aires/Istanbul arrival blocks must remain ordered after repair.
- Late-night nightlife case: real `23:30–00:20` nightlife may keep a `00:25–00:50` return.
- Day 2 pre-dawn museum/activity should shift or move back to prior day, not cascade the whole day into AM.
- Concurrent generation: stale run cannot persist after newer run id is active.

### 7. Add a timing lifecycle trace for debugging
For each day, persist a compact timing trace under day metadata:

```text
input_ai → repair_day → quality_pass → meal_guard → terminal_cleanup → save_normalize → persist_sanity → bookend_verify
```

Each stage records:

- first card
- last real card
- last terminal/bookend card
- any wrap rows
- any cards clamped/dropped
- parser used/version

This gives us a single forensic trail instead of guessing from console logs after the fact.

## Implementation order

1. Add canonical timing helpers and tests.
2. Patch bookend verification so Day 1 arrival logistics cannot become the day tail.
3. Patch persist sanity so non-late hotel returns cannot wrap overnight.
4. Route critical backend timing paths through the canonical helpers.
5. Route frontend parser/read-time bookend logic through the matching mirror.
6. Add generation run idempotency guard.
7. Add real regression fixtures for Istanbul + `21:20–05:20` hotel return.

This is the first fix I would treat as architectural: one timing spine, one hotel-return invariant, one stale-write guard.