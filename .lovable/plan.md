## Problem

`runStep8` in `supabase/functions/generate-itinerary/universal-quality-pass.ts` parses the terminal activity's `end_time` with a bare `/(\d{1,2}):(\d{2})/` regex (lines 141–167). When the AI emits a 12-hour clock value like `"12:16 AM"`, the regex captures `h=12`, which fails both the `14–23` standard window and the `0–2` post-midnight nightlife window — so the function returns silently and no "Return to Hotel" card is appended. Same issue applies to the `start_time` parse used to gate the late-nightlife branch. A correct AM/PM-aware parser already exists as `parseTimeToMinutesLocal` in `day-validation.ts` (line 227) and as `parseTime` in `_shared/timing-cascade.ts` (line 58) — neither is used here.

## Fix

1. **Promote one canonical AM/PM-aware parser.** Reuse the existing `parseTime` already exported from `supabase/functions/_shared/timing-cascade.ts` (handles `HH:MM`, `H:MM AM/PM`, `12 AM → 00`, `12 PM → 12`). Import it into `universal-quality-pass.ts`. Leave `day-validation.ts`'s local copy in place for now (it's a private helper there) — no behavior change needed; just stop adding a third copy.

2. **Rewrite the time parsing inside `runStep8`** (lines 141–167 and the chronological-last scan at lines 100–105):
   - Replace the bare-regex branches with `parseTime(...)`-returned minutes.
   - Derive `h = Math.floor(totalMins / 60)` and `min = totalMins % 60`.
   - Standard window stays `h ∈ [14, 23]`; post-midnight nightlife window stays `h ∈ [0, 2]` and still requires `startHour ≥ 21` plus the existing nightlife title/category gate.
   - The `_toMins` chronological-last helper (lines 100–105) also gets the same upgrade so a `"12:16 AM"` terminal card sorts as `00:16` rather than failing parse and returning `-1`.
   - Synthesis fallback at lines 175–229 also reads start/end via `parseTime` so a `"tba"`/12-hour string falls through to the duration-derived path correctly.

3. **No semantics change** beyond AM/PM correctness — the 14:00 floor, post-midnight nightlife exemption, idempotency, freshen-up / midday-accom rejection, airport short-circuit, and `source: 'late_nightlife_bookend'` tag all stay exactly as today.

## Tests (new)

Add to `supabase/functions/generate-itinerary/__tests__/hotel-return-bookend.test.ts`:

- Terminal nightcap with `endTime: "12:16 AM"`, `startTime: "10:30 PM"`, category `nightlife` → bookend appended, `source === 'late_nightlife_bookend'`, predawn strip leaves it alone (Bruges repro).
- Terminal museum `endTime: "4:30 PM"` (12-hour string) → standard bookend appended (proves the standard-window path also handled AM/PM correctly).
- Terminal cocktail `endTime: "11:45 PM"` → standard bookend appended.
- Idempotency: 12-hour `"12:30 AM"` already-tagged `late_nightlife_bookend` STAY card → no duplicate.

## Files touched

- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — import `parseTime` from `_shared/timing-cascade.ts`; rewrite `_toMins` + the time-window block in `runStep8` to use it; reuse it in the synthesis fallback.
- `supabase/functions/generate-itinerary/__tests__/hotel-return-bookend.test.ts` — 4 new test cases above.

No changes to `day-validation.ts`, repair-day, save-itinerary, or the predawn-strip allowlist — they're already correct; this fix only closes the upstream parser hole that was preventing the bookend from being appended in the first place.

## Memory update on success

Append a sentinel under the existing `[Day-End Hotel-Return Bookend]` memory: "runStep8 time parsing routed through shared `parseTime` (AM/PM-aware); 12-hour-string terminal end_times no longer silently skip bookend (Bruges `"12:16 AM"` repro)."
