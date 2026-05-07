# Fix the 1:05 AM "Spa Time — find a venue" ghost entry on Day 1

## What's actually happening (verified against trip `38f81fab` in DB)

Day 1 of the latest Venice trip stores **two pre-dawn hotel-return entries** sorted to the top:

| time   | title                                              | category      |
|--------|----------------------------------------------------|---------------|
| 01:05  | Return to JW Marriott Venice Resort & Spa          | accommodation |
| 01:50  | Return to Your Hotel                               | STAY          |

Day 2 has the same shape (`00:00` + `23:50` "Return to Your Hotel" duplicates).

This is **not** bleed from a previous trip. It's two compounding bugs in the current trip's generation pipeline:

1. **Step 8 of `universalQualityPass`** (`supabase/functions/generate-itinerary/universal-quality-pass.ts:253-272`) appends `Return to Your Hotel` using `lastActivity.endTime` as `startTime`. When the day's last activity has no `endTime`, ends past midnight, or already IS a hotel return, the appended entry inherits a value that becomes `00:00`/`01:xx`. `normalizeDays` in `action-save-itinerary.ts` then sorts by minutes-since-midnight, hoisting it to position 0.
2. **The midnight stripper** in `sanitization.ts:1546-1579` only runs inside `sanitizeGeneratedDay`, which executes **before** Step 8 re-injects the return. So the stripper never sees these entries.
3. **Client wellness mask** in `wellnessPlaceholderDetection.ts` short-circuits on `category === 'accommodation'` but is rendered via call sites that drop `category` in some places (e.g. `EditorialItinerary.tsx:10915` only forwards `category` and `startTime`, not the full `activity`). When the title contains the word `Spa` (hotel name "JW Marriott Venice Resort & **Spa**") and the activity object isn't passed, a downstream sweep can fall through to title-only matching and replace the title with "Spa Time — find a venue".

## Plan

### 1. Stop the ghost-hotel-return injection at the source
In `universal-quality-pass.ts` Step 8:
- Skip the auto-push entirely if the previous activity is already a STAY/accommodation/`return to` title.
- If the resolved `start_time` falls between `00:00` and `04:59`, clamp it to a sane evening time (e.g. `22:30`) instead of inheriting the wraparound.
- Never default to `lastActivity.endTime` when that value is missing or `<` last activity's `startTime` (clear wraparound signal).

### 2. Make the midnight stripper authoritative
- Move the pre-dawn hotel-return strip from `sanitizeGeneratedDay` into a small shared helper.
- Run it again inside **`terminalCleanup`** (universal-quality-pass.ts:336) AFTER Step 8/dedup, and again inside **`normalizeDays`** in `action-save-itinerary.ts` right before the final sort. Belt-and-braces: anything that lands at hour 0–4 and matches `HOTEL_TITLE_RE` is dropped before persistence.

### 3. Fix the wellness placeholder false-positive on hotel names containing "Spa"
- In `src/utils/wellnessPlaceholderDetection.ts`, broaden the short-circuit so any title matching `HOTEL_LOGISTICS_TITLE_RE` (already includes `return to`) also short-circuits when the venue name contains the substring "Hotel" / "Resort" / "Marriott" / etc., regardless of whether the caller passed a `category`.
- Update `EditorialItinerary.tsx:10915` (and the few other call sites that drop `activity`) to forward the full activity object so the short-circuit gets the category it needs.

### 4. One-shot DB cleanup
Add a small migration that strips already-saved pre-dawn hotel-return rows from `itinerary_days.activities` for in-progress drafts created in the last 7 days, so existing tests no longer show the ghost.

### 5. Regression coverage
- Test that Step 8 never injects a `Return to Your Hotel` after an existing hotel return.
- Test that `normalizeDays` drops any 00:00–04:59 hotel return before save.
- Test that a hotel named "X Resort & Spa" with a `return to` title is **not** masked to "Spa Time — find a venue" by the client sanitizer when `activity` is omitted.

## Files touched
- `supabase/functions/generate-itinerary/universal-quality-pass.ts`
- `supabase/functions/generate-itinerary/sanitization.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `src/utils/wellnessPlaceholderDetection.ts`
- `src/components/itinerary/EditorialItinerary.tsx` (and 1–2 sibling call sites)
- New migration to scrub existing draft trips
- New tests in `supabase/functions/generate-itinerary/__tests__/` and `src/utils/__tests__/`
