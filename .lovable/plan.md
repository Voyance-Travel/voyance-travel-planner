## Bug
LLM generates a pre-dinner freshen-up card whose body says "exchange bike gear for evening attire", but post-processing displaces it past dinner (lands at 22:12) because the bike-tour → dinner gap is only ~15 min. Card is also mistitled "Check-in" instead of "Freshen Up", which lets it slip past `enforceFreshenUpPosition` (that helper requires a freshen-up regex match in the title).

## Fix Strategy

Three coordinated edits, all in the existing pipeline — no new files.

### (a) `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — pre-dinner gap rule

Find the gap/transition rules block (around lines 1200 / 1209 / 1327 — the existing "Minimum gaps" / "NEVER schedule zero-gap" / "REALISTIC travel time" prose).

Add one new explicit HARD RULE line that the LLM must respect:

```
PRE-DINNER GAP RULE: Before any dinner / fine-dining / evening restaurant
activity, leave a MINIMUM 30-minute gap from the preceding activity's end.
If the preceding activity is physically active (matches
\b(bike|cycle|hike|kayak|ski|surf|climb|swim|run|workout|fitness)\b),
the minimum gap is 45 minutes (time to shower/change). The freshen-up
card, if present, MUST fit entirely inside this gap.
```

No code-level enforcement here; this is prompt-only. Code-level enforcement lives in (b).

### (b) `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — pre-dinner placement enforcement

The current §7b ("POST-CHECK-IN DEDUP") relabels late "Check-in" titles to "Freshen Up at <hotel>". After that runs, `enforceFreshenUpPosition` already drops post-dinner freshen-ups (Case A in `_shared/freshen-up-position.ts`). The leak is that some bodies say "before dinner" but the title is generic enough that displaced placement squeezes by.

Add a new step **§7b-bis: PRE-DINNER FRESHEN-UP NARRATIVE ENFORCEMENT**, executed right after §7b and before the existing `enforceFreshenUpPosition` invocation. For each accommodation / freshen-up card whose body text (`description`, `tips`, `notes` concatenated) matches:

```
/\b(before|prior to|ahead of|ready for)\s+(dinner|reservation|fine.?dining|the\s+evening)/i
```

…check whether it currently sits **after** the day's dinner anchor (last dining card with `dinner` in title). If yes:

1. Compute the available gap between the preceding non-logistics activity's `endTime` and `dinnerStart`.
2. Required gap = 30 min, OR 45 min if the preceding activity title matches the "active" regex (`bike|cycle|hike|kayak|ski|surf|climb|swim|run|workout|fitness`).
3. If `gap < requiredGap + freshen-up duration` (default freshen-up duration 20 min) → **drop the freshen-up card** and push a repair entry:

```
console.log(`[repair-day] Day ${dayNumber} dropped freshen-up "${title}" — cannot fit before referenced dinner anchor (gap=${gap}m, required=${required}m)`);
repairs.push({ code: 'FRESHEN_UP_CANT_FIT', action: 'dropped_pre_dinner_no_room', before: title });
```

4. Else → relocate: set the freshen-up `startTime = dinnerStart − requiredGap − freshenDuration`, `endTime = dinnerStart − requiredGap`, and reinsert it at the correct array index (immediately before the dinner card). Record `relocated_pre_dinner`.

Locked / userAdded / extracted / pinned / isManual cards are exempt (mirror the existing guards used elsewhere in repair-day).

### (c) `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — lone "Check-in" on non-arrival days

§7b currently only relabels the **second-and-later** "Check-in" titles. It misses the case where a single "Check-in" card appears on a non-arrival day (no real arrival exists to anchor "first check-in"). Extend the block:

- If `!isFirstDayAtHotel` (use the same predicate the generator uses for the "NO CHECK-IN ON NON-ARRIVAL DAYS" prompt rule — typically `!isArrivalDay && !isHotelChange`), then EVERY accommodation card whose title matches `/\bcheck[\s-]?in\b/i` is relabeled to `Freshen Up at <hotelName>` regardless of position. Log:

```
[repair-day] Day ${dayNumber} relabeled lone "Check-in" → "Freshen Up at ${hn}" (non-arrival day)
```

This guarantees the existing `enforceFreshenUpPosition` pass (which keys on the freshen-up regex) will see the card and drop/clamp it as appropriate.

### Ordering inside `repairDay`

```
…
§7  PRE-CHECK-IN MEAL CLEANUP        (unchanged)
§7b POST-CHECK-IN DEDUP              (extended per fix (c))
§7b-bis PRE-DINNER FRESHEN-UP NARRATIVE ENFORCEMENT   (new per fix (b))
§8  HOTEL CHECKOUT GUARANTEE         (unchanged)
…
§9d-bis enforceFreshenUpPosition     (unchanged; benefits from (b)+(c))
```

## Verification

1. **Static**:
   - `rg "PRE-DINNER GAP RULE" supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` → 1 hit
   - `rg "FRESHEN_UP_CANT_FIT|dropped_pre_dinner_no_room" supabase/functions/generate-itinerary/pipeline/repair-day.ts` → ≥1 hit each
   - `rg "relabeled lone .Check-in" supabase/functions/generate-itinerary/pipeline/repair-day.ts` → 1 hit

2. **Unit test** (new `supabase/functions/generate-itinerary/__tests__/freshen-up-pre-dinner.test.ts`):
   - Day with bike tour 17:45–19:00 + dinner 19:15 + freshen-up body "exchange bike gear before dinner" placed at 22:12 → after `repairDay`, freshen-up is dropped (gap 15m < 45m required) and log line emitted.
   - Same day but dinner at 20:00 → freshen-up relocated to 19:00–19:15 (45m active gap; freshen-up shortened to fit) OR dropped if still no room. Assert it never appears after dinner.
   - Non-arrival day with a single "Check-in at Hotel X" 18:30 → after `repairDay`, title is "Freshen Up at Hotel X".

3. **Existing suite**: `bun test supabase/functions/generate-itinerary/ledger-check.test.ts` and `freshen-up-position*.test.ts` still green.

## Memory

Append to `mem://constraints/itinerary/freshen-up-must-precede-dinner` (already exists per Core memory): note the new §7b-bis pre-dinner narrative enforcement step + lone "Check-in" relabel on non-arrival days. Add sentinel strings `FRESHEN_UP_CANT_FIT` and `relabeled lone "Check-in"` for future triage.

## Files Changed

- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (prose rule)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (extend §7b, add §7b-bis)
- `supabase/functions/generate-itinerary/__tests__/freshen-up-pre-dinner.test.ts` (new)
- `mem://constraints/itinerary/freshen-up-must-precede-dinner` (append)

No DB, RLS, edge-fn-config, or frontend changes.