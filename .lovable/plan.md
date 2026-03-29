

## Rome Trip Audit — Fix Plan

### Investigation Summary

Queried the actual trip data (`1c405809`). Confirmed:
- `hotel_selection` is **NULL** — the AI fabricated "The Pantheon Iconic Rome Hotel" entirely
- Day 1: 9 activities in DB, Day 2: 11, Day 3: 12, Day 4: 3
- No days are locked (`metadata.isLocked` is null on all days)
- Day 3/4 "only 1 visible" is likely a frontend rendering issue (needs browser investigation)

### Fixes (6 total)

---

**FIX 1: Strip "Voyance Pick" / "Hotel Pick" from titles**

Both `sanitizeAITextField` (backend, `sanitization.ts`) and `sanitizeActivityName` (frontend, `activityNameSanitizer.ts`) lack rules for these suffixes.

- Add regex: `/\s*(?:Voyance\s+Pick|Hotel\s+Pick)\s*$/gi` to strip from titles
- Backend: Add to `sanitizeAITextField` in `sanitization.ts` line ~85
- Frontend: Add to `sanitizeActivityName` in `activityNameSanitizer.ts` after system prefix stripping

---

**FIX 2: Expand phantom hotel stripping patterns**

`stripPhantomHotelActivities` in `sanitization.ts` misses:
- "Breakfast at \<fabricated hotel\>" (only catches "hotel breakfast", not "breakfast at...hotel")
- "Taxi to Hotel" (no pattern for generic hotel transport)
- Non-luxury fabricated names like "The Pantheon Iconic Rome Hotel" (not in `FABRICATED_HOTEL_RE`)

Changes to `sanitization.ts`:
- Add patterns: `/\bbreakfast at\b.*\bhotel\b/i`, `/\btaxi to (?:the )?hotel\b/i`, `/\btransfer to (?:the )?hotel\b/i`
- Add a generic catch-all: any title containing "Hotel" when `hasHotel === false` AND category is `dining`, `transport`, or `accommodation` should be stripped

---

**FIX 3: Fix consecutive duplicate word in titles**

"The Pantheon Pantheon Iconic Rome Hotel Pick" — existing dedup only checks last two words. Need general consecutive-word dedup in `sanitizeActivityName`.

Add after line 122 in `activityNameSanitizer.ts`:
```typescript
// Remove any consecutive duplicate word (case-insensitive)
sanitized = sanitized.replace(/\b(\w+)\s+\1\b/gi, '$1');
```

---

**FIX 4: Fix meal time ordering (Lunch at 19:10 after Dinner at 19:00)**

Two issues:
1. Activities are not sorted chronologically after generation — "Lunch at Chorus Café" at 19:10 appears after "Dinner at Palazzo Fendi" at 19:00
2. A meal labeled "Lunch" at 19:10 should be relabeled "Dinner" (or removed as duplicate dinner)

Changes:
- In `generation-core.ts` post-processing (around the chronological sort at line 1645), apply `enforceMealTimeCoherence` to all meal activities after sorting
- In `action-generate-trip-day.ts`, add the same meal coherence check after day assembly

---

**FIX 5: Investigate Day 3/4 rendering bug (browser required)**

Day 3 has 12 activities in DB but user reports only 1 visible. Days are NOT locked. This requires browser investigation to determine if:
- `canViewDay()` is returning false incorrectly
- The `DayCard` component is filtering activities
- A CSS/layout issue is hiding content

This fix requires using browser tools to inspect the live trip page.

---

**FIX 6: Backend text sanitization for `,type` leaks, booking urgency, AI self-commentary**

These are already partially handled by `sanitizeAITextField` (lines 85-91 in `sanitization.ts`), but the `TEXT_SCHEMA_LEAK` regex may be too narrow. Verify coverage and add:
- `,type` at field boundaries: `/,\s*type\b/gi` stripping
- Ensure `BOOK/RESERVE` urgency regex covers all variants seen in production

---

### Deployment Order

1. FIX 1 + FIX 3 (title sanitization — immediate visual improvement, both frontend + backend)
2. FIX 2 (phantom hotel stripping — prevents fabricated hotel from appearing)
3. FIX 4 (meal time ordering — fixes scheduling confusion)
4. FIX 5 (browser investigation for rendering bug)
5. FIX 6 (text quality polish)

### Files Modified

| File | Fixes |
|---|---|
| `src/utils/activityNameSanitizer.ts` | FIX 1, FIX 3 |
| `supabase/functions/generate-itinerary/sanitization.ts` | FIX 1, FIX 2, FIX 6 |
| `supabase/functions/generate-itinerary/generation-core.ts` | FIX 4 |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | FIX 4 |

