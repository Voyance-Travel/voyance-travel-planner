

## Itinerary Content Quality Fixes — 5 Root Causes

This plan addresses five distinct quality issues found in generated itineraries. Changes span the edge function sanitization layer, the generation chain handler, and the client-side meal guard.

---

### Bug 1: Empty Days Masked by Placeholder Meals

**Problem**: When the generation chain breaks at Day N, Days N+1 onward have zero activities. The client-side `mealGuard.ts` then injects generic placeholder meals ("Breakfast at a boulangerie-café"), hiding the failure from users.

**Fix**: In `mealGuard.ts` `enforceItineraryMealCompliance()`, skip meal injection when a day has zero activities and flag it as `_ungenerated = true`. Also increase chain retries from 3→5 and backoff from 2000→3000ms in `index.ts` (line 13487-13513).

---

### Bug 2: Missing Sanitization Regex Patterns

**Problem**: Several leaked AI text patterns slip through existing sanitization:
- `,type` — schema field not in TEXT_SCHEMA_LEAK list
- `BOOK 2-4 WEEKS` — freestanding uppercase booking urgency (BOOK_CODE_RE only catches `book_now` style)
- `This addresses the wellness interest` — AI self-commentary not caught by AI_SELF_COMMENTARY_RE
- `the destination` as placeholder text

**Fix in `sanitization.ts`**:
1. Add 4 new regex patterns: `BOOKING_URGENCY_TEXT_RE`, `AI_ADDRESSES_RE`, `COMMA_FIELD_LEAK_RE`, `GENERIC_DESTINATION_RE`
2. Add optional `destination` parameter to `sanitizeAITextField()` — when provided, replace "the destination"/"the city" with actual city name
3. Add `destination` parameter to `sanitizeGeneratedDay()` and pass it through to all `sanitizeAITextField` calls
4. Update all callers of `sanitizeGeneratedDay` in `index.ts` (lines 2423, 2431, 10340, 10349) to pass the destination

---

### Bug 3: Phantom Hotels

**Already handled** — The codebase already has `enforceHotelPlaceholder()` and `enforceHotelPlaceholderOnDay()` in `sanitization.ts` (lines 259-340) that replace hallucinated hotel brands with "Your Hotel". No additional code changes needed for this bug. The existing 30+ brand regex covers the reported "Hotel Le Meurice" case (Meurice is not in the list, but can be added if needed). Will add "Le Meurice" and a few other common Paris hotels to the brand list as a small enhancement.

---

### Bug 4: Cross-Day Venue Duplication

**Problem**: The AI is told about previous days' activities via `previousActivities` (line 13042-13047), but enforcement is prompt-only. When the AI ignores the instruction, duplicates like "Louvre on Day 1 AND Day 2" go straight to the database.

**Fix**: Add a `deduplicateCrossDayVenues()` function in `sanitization.ts` that:
- Builds a set of venue names/location names from `existingDays`
- Filters activities from the new day, removing sightseeing/attraction/museum/landmark/tour activities whose name matches a previous day
- Keeps meals, transport, and hotel activities (those can legitimately repeat)
- Call it in the `generate-trip-day` handler (around line 13141) after `dayResult` is obtained, before saving

---

### Bug 5: Activities Out of Chronological Order

**Problem**: AI sometimes generates activities with out-of-order or overlapping times. No post-generation enforcement exists.

**Fix**: Add time-ordering logic at the end of `sanitizeGeneratedDay()`:
1. Sort activities by `startTime` using minute parsing
2. Walk the sorted list and push overlapping activities forward by 15 minutes
3. Add helper functions `parseTimeToMinutes()` and `minutesToHHMM()` to `sanitization.ts`

---

### Files Changed

| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Add 4 regex patterns, `destination` param to `sanitizeAITextField`/`sanitizeGeneratedDay`, time-ordering logic, `deduplicateCrossDayVenues()`, add "Le Meurice" to hotel brands |
| `supabase/functions/generate-itinerary/index.ts` | Pass `destination` to `sanitizeGeneratedDay` calls (4 locations), call `deduplicateCrossDayVenues` after day generation, increase chain retries 3→5 and backoff 2000→3000ms |
| `src/utils/mealGuard.ts` | Skip meal injection on zero-activity days, flag as `_ungenerated` |

### Deployment

Single edge function redeploy after all changes. No database migrations needed.

