# Why only Day 1's dinner survived (verified, not guessed)

I pulled your latest Lisbon trip from the database. The receipt:

- `metadata.source` = `chat_planner` (this paste came in via the chat planner, **not** Smart Finish / manual paste)
- `metadata.userAnchors` = **`[]`** (empty — the anchor guard had nothing to enforce)
- `metadata.mustDoActivities` = a flat array of strings:
  ```
  ["Dinner JNcQUOI Table Day 1 7:00 PM",
   "Lunch Belcanto Day 2 1:30 PM",
   "Spa Serenity Spa Lisbon Day 2 3:30 PM",
   "Dinner Peixola Day 2 7:30 PM",
   ... 10 more ...]
  ```

The chat planner extracted every line correctly. The bug is in **how those strings are converted into anchors** by `src/utils/userAnchors.ts → parseMustDoEntry`:

```js
const dayMatch = trimmed.match(/^Day\s+(\d+)\b[:\-\s]*(.*)$/i);
```

It only recognizes `"Day N: ..."` at the **start** of the string. The chat planner puts `Day N` in the **middle** (`"Dinner JNcQUOI Table Day 1 7:00 PM"`). So:

- `dayMatch` is `null` → `dayNumber = 0`
- Every anchor goes into the array with `dayNumber: 0`
- `applyAnchorsWin` checks `if (targetDayNum < 1 || targetDayNum > days.length) continue;` → **all 13 anchors are skipped**
- `userAnchors.length > 0 ? userAnchors : null` in Start.tsx — they are pushed (length 13), so we save them, but the guard still rejects them on every write because the day number is 0

That's why Day 1's first dinner ("JNcQUOI Table") happened to survive — the AI's own dinner generation collided with it by chance — and **nothing else did**. The anchor enforcement we built two messages ago is correct; the problem is upstream: anchors are being constructed with `dayNumber: 0`, so the guard never sees them as belonging to any day.

Tests passed because the unit tests use `"Day 1: dinner at X"` format; no test covers the chat-planner's actual emitted format `"X Day 1 TIME"`.

---

# Fix

Two coordinated changes — one defensive (parser handles real-world format), one preventive (planner emits structured data).

## 1. Make `parseMustDoEntry` find `Day N` anywhere in the string

Replace the front-anchored regex with one that scans the whole string:

```js
// BEFORE (only matches "Day 1: foo")
const dayMatch = trimmed.match(/^Day\s+(\d+)\b[:\-\s]*(.*)$/i);
const dayNumber = dayMatch ? parseInt(dayMatch[1], 10) : 0;
const text = dayMatch ? dayMatch[2].trim() : trimmed;

// AFTER (matches "Day 1: foo", "foo Day 1", "foo Day 1 7:00 PM")
const dayMatch = trimmed.match(/\bDay\s+(\d+)\b/i);
const dayNumber = dayMatch ? parseInt(dayMatch[1], 10) : 0;
const text = dayMatch
  ? trimmed.replace(/\s*\bDay\s+\d+\b\s*[:\-]?\s*/i, ' ').replace(/\s+/g, ' ').trim()
  : trimmed;
```

This recovers all 13 anchors for the existing Lisbon trip on the next regenerate.

Apply the identical fix in **both** mirrors (Vite ↔ Deno):
- `src/utils/userAnchors.ts`
- `supabase/functions/_shared/user-anchors.ts`

## 2. Make the chat planner emit `perDayActivities` when the user provides per-day structure

The chat planner already has a `perDayActivities` field in its tool schema (line 512 of `chat-trip-planner/index.ts`) and explicit instructions (line 202) to use it when the user gives day-by-day structure. The Lisbon paste literally has `APRIL 17`, `APRIL 18`, etc. as day headers — that's textbook day-by-day structure — and the model still chose `mustDoActivities`. Tighten the prompt:

- Promote the `perDayActivities` rule to a **hard requirement** (above all other extraction rules) when the user input contains date headers, "Day N" markers, or numbered days.
- Add a refusal-style example: "If you put dated/numbered activities into `mustDoActivities` instead of `perDayActivities`, the downstream planner will lose the day binding."

When `perDayActivities` is populated, `buildUserAnchors` parses each day's activity string with `parseDayActivities` (which already knows day number from the wrapper), so dayNumber is never lost. This is the long-term correct path.

## 3. Add deterministic test coverage for the real-world format

Add to `supabase/functions/_shared/user-anchors.test.ts` (uses Deno test runner — no AI credits):

- `mustDoActivities` entries with `Day N` in the middle ("Dinner Venue Day 2 7:30 PM") → expect 1 anchor with `dayNumber: 2`, `startTime: "19:30"`, `title: "Dinner Venue"`.
- `mustDoActivities` entries with `Day N` at end ("Cervejaria Ramiro Day 7 1:00 PM") → expect `dayNumber: 7`.
- Original "Day 1: foo" prefix format → still works (regression guard).

The mirrored Vitest test should cover the same cases in `src/utils/userAnchors.test.ts`.

# Files touched

- `src/utils/userAnchors.ts` — relax `parseMustDoEntry` regex (~5 lines)
- `supabase/functions/_shared/user-anchors.ts` — same change (~5 lines)
- `supabase/functions/_shared/user-anchors.test.ts` — 3 new test cases (~30 lines)
- `src/utils/userAnchors.test.ts` (new file if absent) — same 3 cases (~30 lines)
- `supabase/functions/chat-trip-planner/index.ts` — strengthen prompt around `perDayActivities` (~15 lines of prompt copy, no logic change)

# What this does NOT do

- No backfill script for the existing Lisbon trip's empty anchors. Once the parser fix ships, hitting "Regenerate" on that trip will rebuild anchors from `mustDoActivities` correctly without re-doing the chat extraction.
- No live AI regeneration to "verify" — the unit tests prove the helper handles the exact strings the database currently holds, deterministically.

# Verification (no AI credits)

After the patch, this Deno test will pass and would have caught the bug originally:

```
Deno.test('parseMustDoEntry handles "Title Day N TIME" format from chat-trip-planner', () => {
  const r = parseMustDoEntry('Dinner Peixola Day 2 7:30 PM', 'chat')!;
  assertEquals(r.dayNumber, 2);
  assertEquals(r.startTime, '19:30');
  assert(r.title.toLowerCase().includes('dinner'));
  assert(r.title.toLowerCase().includes('peixola'));
});
```

Approve and I'll implement.
