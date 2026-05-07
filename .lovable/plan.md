## Problem

Two distinct ghost entries are still slipping into the persisted itinerary and rendering at the **top of Days 1 and 2** at pre-dawn / midnight times:

1. **`Spa Time — find a venue`** — the placeholder string the generator writes when no curated wellness DB venue and no hotel name are available (`pipeline/repair-day.ts` §wellness, line 693). It is never meant to be saved/displayed; it's a "needs refinement" stub. Only the *generator* repair pass produces it; nothing scrubs it on the read side.
2. **`Return to Your Hotel`** at `00:00`–`04:59` with the **previous-night's** or **wrong** hotel address. The shared `stripPreDawnHotelReturns` helper (`supabase/functions/_shared/predawn-hotel-strip.ts`) is wired into every *write* path (universal-quality-pass, sync-tables, save-itinerary, persist-day, action-generate-trip-day) but:
   - Is **not** run on read in the frontend — every legacy/migrated trip already has these rows persisted (DB confirms 30+ trips with `Return to Your Hotel` at `00:05`, `01:30`, `00:16`, etc.).
   - Inserts the entry **at the END of the array** with `start_time = end of previous activity`. When that previous activity ended `23:35`, the new entry inherits a 1-hour duration into post-midnight (`00:35`), and a later sort places it **first** the next render.

## Root cause (per surface)

| Surface | Why ghosts survive |
| --- | --- |
| `repair-day.ts` line 690-705 | Writes `Spa Time — find a venue` as a "transient" title but persists it; no terminal pass strips wellness placeholders before save. |
| `universal-quality-pass.ts` Step 8 (line 254-292) | Computes `startTime24` from `lastActivity.endTime`. If the LLM emitted `endTime: "23:50"` and the helper rounds via `+30m` elsewhere, it can wrap to `00:20` and not be caught (HOTEL_TITLE_RE matches but the *new* row is appended before the strip pass on the *next* tick on the *previous* day's array). |
| Frontend (`EditorialItinerary.tsx` / `CustomerDayCard.tsx`) | Renders raw `day.activities` in array order. A row that ended up at index 0 with a `00:xx` time is shown verbatim. No display-time filter for pre-dawn hotel returns or `find a venue` titles. |
| Address attribution | `Return to Your Hotel` rows persist a stale `location.address` from the LLM. When the user later changes their accommodation, the address is never refreshed (the hotel-context propagator only re-stamps activities matched by venue name or `skipEnrichment`, but the legacy row was saved without `skipEnrichment: true`). |

## Fix

### 1. Generator: stop emitting the `find a venue` placeholder (server)

In `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (≈ line 690 — the `else` branch when there's no fallback DB, no hotel, no real venue):

- **Remove the activity entirely** instead of renaming it to `Spa Time — find a venue`.
- Push a `repairs` entry with `action: 'removed_unverifiable_wellness'` so the dead-gap nudge can fire.
- Update `wellnessPlaceholderDetection.test.ts` to reflect: when no venue is resolvable, the slot is dropped, not masked.

### 2. Generator: harden pre-dawn return injection

In `universal-quality-pass.ts` Step 8 (line 254-292):

- After computing `startTime24`, validate `parseInt(startTime24.slice(0,2)) >= 17` (a hotel return before 5pm is nonsense). If not, skip injection — the day truly has no late activity to return from.
- Always set `endTime` to `min(startTime24 + 30m, "23:59")` and never let it wrap.
- After Step 8, run `stripPreDawnHotelReturns(result, …)` (already imported at line 33) in addition to the existing call at line 296 — this catches the row we just inserted if its time still landed pre-dawn for any reason.

### 3. Frontend: display-time scrubber for legacy trips

The DB already contains thousands of legacy ghost rows; we can't migrate every one (some users have edited around them). Add a render-time filter so the user **never sees** the bad rows, while leaving the row in the DB until the next save naturally rewrites it.

Create `src/lib/itinerary/hideGhostActivities.ts`:

```ts
const HOTEL_RETURN_RE = /return\s+to\s+(your\s+)?[^,]*hotel|back\s+to\s+(the\s+)?hotel/i;
const WELLNESS_PLACEHOLDER_RE = /find a venue\s*$/i;
const PRE_DAWN_MAX = 5 * 60; // 05:00

export function isGhostActivity(a: any): boolean {
  // A: wellness placeholder string
  if (WELLNESS_PLACEHOLDER_RE.test(a?.title || '')) return true;
  // B: pre-dawn hotel return
  const t = a?.startTime || a?.start_time || a?.time;
  if (typeof t === 'string' && HOTEL_RETURN_RE.test(a?.title || '')) {
    const m = t.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      if (mins < PRE_DAWN_MAX) return true;
    }
  }
  return false;
}
```

Apply in:
- `EditorialItinerary.tsx` — wherever `day.activities` is mapped for rendering, filter through `!isGhostActivity`.
- `CustomerDayCard.tsx` — same.
- `PaymentsTab.tsx` / `usePayableItems.ts` — already filter $0 walks; add the same ghost guard so the bad rows don't appear in payable lists or the budget snapshot.

### 4. One-time DB scrub for in-memory hot trips

Run a migration that clears confirmed-junk rows from `itinerary_data`:

```sql
-- Strip activities matching ghost criteria from itinerary_data.days[].activities[]
-- using a jsonb walker (mirroring sync_activity_cost_to_itinerary_jsonb pattern).
```

Two predicates only — both already validated above:
- `title ~* 'find a venue\s*$'`
- `(title ~* 'return.*hotel') AND startTime/start_time hour ∈ [0..4]`

Skip rows where `is_locked = true` or `source IN ('user', 'manual')` — those are user-edited and we never touch them.

### 5. Address refresh on hotel-context change (defensive)

When a user updates accommodation (`unified-accommodation-selector` flow), the existing context propagator should re-stamp `location.address` on every activity whose `title` matches `HOTEL_RETURN_RE` (not just exact venue-name matches). Add that one regex branch to the propagator so future address-mismatch ghosts can't accumulate.

## Verification

- After deploy: run the same `find a venue` / pre-dawn query — count should drop monotonically as users open their trips and the next save scrubs each one.
- Add a Deno test in `_shared/predawn-hotel-strip.test.ts` covering the wraparound case (last activity ends `23:50` → injected return must NOT land pre-dawn).
- Unit test `isGhostActivity` for: `Return to Your Hotel @ 00:05` → true; `Return to JW Marriott @ 22:30` → false; `Spa Time — find a venue` → true; `Spa Session at JW Venice Spa` → false.

## Out of scope

- The address-mismatch root cause for *legitimate* hotel returns (correct time but stale address after hotel swap) is partly addressed by Step 5 but a full audit of the accommodation-change propagator is a separate ticket.
- Wellness fallback DB expansion (so fewer cities fall through to the now-removed placeholder) is a content task.
