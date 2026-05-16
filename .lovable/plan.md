## Step 3 Must-Do Hardening Pass

Make the free-text Must-Do textarea legible to users *and* more parseable to the backend, without changing the anchor or priority-parsing contracts.

### 1. Live parse preview (frontend only)

In `src/components/planner/ItineraryContextForm.tsx`:
- Reuse the existing `buildUserAnchors({ mustDoActivities, source: 'manual_paste' })` from `src/utils/userAnchors.ts` (no new parser) inside a debounced `useMemo` against the textarea value.
- Render a small "We understood:" chip list under the textarea showing each parsed anchor as `Day N · 7:30 PM · Dinner at Roscioli`. Items where `dayNumber === 0` render as `Any day · …` in muted style with a tooltip "Tip: add 'Day 2' to pin to a specific day".
- Render parse failures (lines that produced no anchor) under a "Couldn't parse:" line so the user can fix them in place.
- No business-logic changes — the chip list is purely a mirror of what the backend will see.

### 2. Lightweight input affordances

In the same component:
- Add a character counter (`{n} / 1500`) and a soft cap at 1500 chars with `maxLength`.
- Add two ghost buttons above the textarea: "Add Day N" inserts `\nDay 2: ` at the cursor; "Add time" inserts `7:30 PM `. Pure text-insertion helpers, no state model change.
- Update placeholder to teach the syntax: `e.g.\nDay 1: Colosseum 9am\nDay 2: Dinner at Roscioli 7:30 PM\nDay trip to Tivoli`.

### 3. Match chat-planner extraction in the simple form

In `ItineraryPreview.tsx::handleContextSubmit` (L294-338):
- When the parsed anchors include any with `dayNumber > 0`, *also* write a `perDayActivities` array to `trips.metadata` (group anchors by dayNumber, join titles with `, `). This mirrors what `chat-trip-planner` does, so the backend's existing `perDayActivities`-preferred path (intent-normalizers §3c) kicks in and pins items to the right day. The original `mustDoActivities` string is still written as fallback.

### 4. Persist intent + tests

- Stamp `metadata.mustDoSource = 'simple_form'` so anchor-guard / telemetry can distinguish the chat-planner vs textarea origin.
- Add `src/utils/userAnchors.test.ts` cases covering the new placeholder examples to prevent regressions in `parseMustDoEntry` (`Day N` mid-string, inline times, day-trip phrasing).

### Out of scope
- No changes to `must-do-priorities.ts` (priority parsing), `anchor-guard.ts`, or `enrich-day.ts`. The new constraint `mem://constraints/itinerary/anchor-enrichment-allowed` already handles description/address backfill for the anchors this produces.
- No structured form fields per item (date pickers / time pickers per row) — the textarea stays the canonical input; we're just making the parse visible.
- No DB schema changes — everything rides on existing `trips.metadata`.

### Verification
1. Type `Day 1: Colosseum 9am, Day 2: Dinner at Roscioli 7:30 PM` → confirm 2 chips, correct day + time.
2. Type `Tivoli day trip` alone → chip shows `Any day · Tivoli day trip`.
3. Submit and inspect `trips.metadata` → `mustDoActivities` (string) + `perDayActivities` (grouped) + `mustDoSource: 'simple_form'` all present.
4. Generate → `[ENRICH_ANCHOR]` fires for required cards, addresses + descriptions populate.
5. Reload → DB is source of truth, chips re-derive identically.
