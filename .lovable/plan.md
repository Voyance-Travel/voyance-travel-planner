## Goal

Stop the midnight orphan hotel-return card from (a) sitting at the top of Day 1 and (b) bleeding into Day 2 morning and dragging real activity times to 1:33 AM / 3:26 AM / 6:31 AM. The defenses already exist for Day N≥2 head-bookend drop and pre-dawn cascade normalization, but two gaps let it through.

## Gaps found

1. **Day 1 head-bookend drop is missing.** `parseItineraryDays` Step 4 only drops a stale `bookend-readtime`/`bookend-overnight`/`late_nightlife_bookend` row when it sits at index 0 of Day **N≥2** (`if (idx > 0 && …)`). Sapporo's "orphan at top of Day 1" reproduces because no rule fires for Day 1.
2. **Pre-dawn cascade skips Day 1 and bails on the first "exempt" card.** `normalizePredawnCascade` returns immediately when `dayIndex <= 0`, and the leading block walk breaks the moment it hits any locked / booked / departure-logistics row — so a single booked museum at 01:33 AM stops the heal and the rest of Day 2 stays cascaded.
3. **Save-time net only runs on the cascade rule.** When a hotel-return bookend with a `[00:00, 05:59]` start ends up persisted as the *first* row of Day 2 (chronologically), the dedupe / drop only fires at parse time. Hard reload looks fine, but the next save can re-persist the predecessor's tail back into Day 2's head if upstream gen path didn't reorder.

## Plan

### 1. Extend head-bookend drop to Day 1 (and any day)
File: `src/utils/itineraryParser.ts` (Step 4, around L815).
- Drop the `idx > 0` guard. Replace with: drop a row at index 0 when it is bookend-source-like (`bookend-readtime` / `bookend-overnight` / `bookend-validator` / `bookend-synthesized` / `late_nightlife_bookend`, by `source`, `tags`, or `id` prefix) **AND** its start time falls in `[00:00, 05:59]` **AND** at least one later activity on the same day has a start in `[06:00, 23:59]`. The "real activities later" check is what makes it safe to apply on Day 1 — we never strip a legitimate Day 1 evening bookend that just happens to be alone.
- Locked / user / manual / extracted / pinned rows stay exempt.
- Log `[BOOKEND_TRACE] day=N site=parse action=dropped reason=stale_predawn_head_any_day`.

### 2. Make pre-dawn cascade run on every day and not bail early
File: `src/lib/itinerary/normalizePredawnCascade.ts` (mirror in `supabase/functions/_shared/predawn-cascade-normalize.ts`).
- Remove the `dayIndex <= 0` early return. Day 1 can have the same Moco-Museum-at-1:33-AM bleed if the upstream gen cascaded from a stale tail.
- Inside the leading block walk, change the exit conditions so that:
  - `isBookendSourceLike` still breaks (we don't want to shift the bookend itself; Step 1 above already strips it).
  - `isLockedLike` and `isDepartureLogistics` no longer break the walk *while still inside the pre-dawn window* — they're skipped (left in place) but the walk continues so subsequent non-exempt pre-dawn rows still get shifted. Locked/booked rows in pre-dawn are still wrong, but moving them risks fighting user intent; leaving them alone while healing the rest matches the existing "never modify locked rows" policy.
- Keep the `+shift` math (target first non-exempt start = 09:00) but compute `firstStart` from the first **non-exempt** pre-dawn row, not `list[0]`, so a locked row at 00:30 doesn't anchor the shift.

### 3. Add Day 1 + Day 2 regression tests
File: `src/utils/__tests__/itineraryParser.departureDayHotelReturnStrip.test.ts` (extend) and `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts` (add cases).
- Sapporo-shape: Day 1 with `bookend-readtime` at 00:30 followed by real Day 1 morning activities → bookend dropped, morning untouched.
- Amsterdam-shape: Day 2 with three real museum/cafe rows at 01:33 / 03:26 / 06:31 → pre-dawn block shifted forward; the 06:31 row stays put (outside pre-dawn window); a locked row mid-block doesn't stop the heal.
- Locked Day 1 evening hotel-return at 22:30 (legit) is **not** stripped (negative case).

### 4. Telemetry / memory
- Update `mem://constraints/itinerary/late-nightlife-no-next-day-bleed` and `mem://constraints/itinerary/predawn-cascade-defense-layer` with the Day 1 extension and the "skip-don't-break" walk change.
- Add one-line entry to `mem://index.md` referencing the existing memory (no new entry needed — same root cause class).

## Out of scope

- No changes to the generation-time bookend builder (`ensureHotelReturnBookend`). Its existing late-nightlife branch and gray-zone branch stay as they are; we're only hardening the read-time + parse-time + save-time defenses that catch what slips past it.
- No backend `safeUpdateItineraryData` self-heal trigger changes — the existing `'self-heal-predawn-cascade'` path already fires when the parser reports `count > 0`, so the relaxed walk in step 2 will automatically expand its coverage.

## Verification

- Run the new tests.
- Open Amsterdam / Sapporo trips in preview, confirm Day 1 has no orphan top card and Day 2 morning starts at sane times. Console should show `[BOOKEND_TRACE] action=dropped reason=stale_predawn_head_any_day` and `[PREDAWN_CASCADE_NORMALIZE]` with non-zero `count`.