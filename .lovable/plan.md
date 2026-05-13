## Bug summary

When Day 1's last activity ends past midnight, a "Return to {hotel}" bookend is correctly emitted by `runStep8` with `source: 'late_nightlife_bookend'` and start ~00:16. On the **next day**, the user sees that 12:xx AM card appear under the **Morning** section, and Day 2's real activities cascade to absurd AM times (Amsterdam: 1:33 / 3:26 / 6:31 AM).

There are two independent failure modes that combine to produce this. Both must be fixed.

---

## Root cause #1 — Backend: late-nightlife bookend leaks into next day's AI prompt

`supabase/functions/generate-itinerary/action-generate-trip-day.ts` builds `previousActivities` (line ~609) from the previously-generated day's full activities array, which now includes the `late_nightlife_bookend` card with `start_time = "00:16"`. The Day 2 prompt sees a "previous activity ending at 00:41" and the model schedules Day 2's first card just after that, producing 01:33 / 03:26 / 06:31. The post-generation cascade (`enforceTimingAndBuffers`) is wrap-aware on Day 2 alone and does not re-anchor those AM times back to a normal 09:00 morning.

### Fix

Filter `previousActivities` (and any other cross-day context payload — `previousDays`, restaurant/venue history is fine) so cards tagged `late_nightlife_bookend` / `bookend-readtime` / `bookend-overnight` / `bookend-validator` / `bookend-synthesized` and any card whose `start_time` is in `[00:00, 06:00)` are stripped before being sent to the next day's prompt. Add a `[PREV_DAY_PRUNED]` log line listing what was dropped.

Audit the same payload shape in:
- `action-generate-trip-day.ts` chain build of `previousActivities`
- `generate-itinerary/index.ts` (and `pipeline/*` if it builds `previousDays` for repair / multi-day finalization)

Add a save-time anchor guard: in `action-save-itinerary.ts normalizeDays`, if Day N (N≥2) opens with an activity whose `start_time` < 06:00 **and** Day N-1 has a `late_nightlife_bookend` tail, push the cascade by re-anchoring Day N's first non-locked, non-logistics card to a normal morning slot (≥09:00). Log `[NEXT_DAY_AM_REANCHOR] day=N from=… to=09:00`. Locked / user / manual / extracted / pinned rows exempt.

### Tests

`supabase/functions/generate-itinerary/__tests__/late-nightlife-no-next-day-bleed.test.ts`:
1. Day 1 ends with `late_nightlife_bookend` 00:16→00:41 → `previousActivities` payload sent to Day 2 contains zero bookend cards and zero `<06:00` cards.
2. Day 2 generation receives no pre-dawn context, so its first activity is ≥09:00.
3. Save-time re-anchor: synthetic Day 2 starting at 01:33 with a Day 1 late-nightlife tail gets re-anchored to 09:00 (and downstream cards cascade from there, not from 01:33).
4. Locked Day 2 first card at 01:33 is **not** re-anchored.

---

## Root cause #2 — Frontend: hour-band labeller groups midnight bookends as "Morning"

`src/components/itinerary/EditorialItinerary.tsx` (~L10755) computes:

```
hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
```

Any card with `startTime` in the `00:00–05:59` wrap window — including the legitimate Day-N late-nightlife bookend that should visually sit at the bottom of Day N — falls into "Morning". That is the "12:xx AM card under Morning" the user sees. It also makes a stale Day 2 first card at 01:33 read as the day's morning anchor.

### Fix

1. Introduce a `Late Night` band: `hour < 5 ? 'Late Night' : hour < 12 ? 'Morning' : ...`. Apply to both `timeOfDay` and `prevTimeOfDay` (~L10755 and L10771). Render the section header only when the band changes — a tail bookend at 00:16 then closes Day N under "Late Night" instead of opening Day N+1 under "Morning".
2. Display safety net mirroring `dedupeHotelReturnBookends`: at the parser's Step 4 / Step 4b in `src/utils/itineraryParser.ts`, if Day N (N≥2) opens (index 0 after wrap-aware sort) with a card whose `source ∈ {late_nightlife_bookend, bookend-readtime, bookend-overnight}`, drop it from Day N (it belongs to Day N-1's tail). Log `[BOOKEND_TRACE] site=parse action=dropped reason=stale_next_day_head`. Idempotent.

### Tests

`src/utils/__tests__/itineraryParser.lateNightlifeNextDayHead.test.ts`:
1. Day 2 first activity sourced as `late_nightlife_bookend` 00:16 → dropped from Day 2; logged.
2. Day 2 first activity is a real 09:00 card → no change.
3. Day 1 tail bookend 00:16 with Day 2 starting 09:00 → both untouched.

`src/components/itinerary/__tests__/timeOfDayBand.test.tsx` (new, minimal — just exercise the helper if extracted, otherwise snapshot):
1. 00:16 → 'Late Night' (not 'Morning').
2. 05:30 → 'Morning'.
3. Header transitions correctly Evening → Late Night → Morning.

Extract the band helper to `src/lib/itinerary/timeOfDayBand.ts` so the test can target it without rendering the whole `EditorialItinerary`.

---

## Memory updates

Add `mem://constraints/itinerary/late-nightlife-no-next-day-bleed`:
- `previousActivities` and any cross-day prompt payload MUST strip bookend cards + `<06:00` start times before being sent to the next day's generation.
- Save-time `normalizeDays` re-anchors Day N (N≥2) opening `<06:00` to a normal morning when Day N-1 carries a late-nightlife bookend.
- Parser drops stale `late_nightlife_bookend` / `bookend-*` cards sitting at index 0 of Day N≥2.
- Display band: `hour<5 = 'Late Night'`, never 'Morning'.

---

## Files touched (no business logic changes beyond the four enumerated)

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — strip bookend/predawn rows from `previousActivities` payload + log `[PREV_DAY_PRUNED]`.
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — `normalizeDays` next-day AM re-anchor when prior day has late-nightlife tail.
- `src/utils/itineraryParser.ts` — Step 4 head-bookend drop on Day N≥2.
- `src/lib/itinerary/timeOfDayBand.ts` — new helper.
- `src/components/itinerary/EditorialItinerary.tsx` — use the helper at L10755 & L10771; add 'Late Night' band.
- New tests as listed above.
- `mem://constraints/itinerary/late-nightlife-no-next-day-bleed`.

No DB migration. No table schema change. No cost/budget change.