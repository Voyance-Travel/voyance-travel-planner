## Fix: Meal cards disappear on hard reload

### What we know
- Payments tab shows 7 dining items; itinerary view after hard reload shows fewer.
- `activity_costs` rows (Payments source) are written by `writeActivityCostsFromItinerary` directly from `trips.itinerary_data.days[].activities[]`. So if Payments has 7 dining rows, the 7 dining cards **did persist** into `itinerary_data` at save time.
- Therefore the drop happens on the **read path**, between `trips.itinerary_data` and the rendered itinerary.

### Read path (confirmed)
`useLovableItinerary` / `TripDetail` / `EditorialItinerary` → `supabase.from('trips').select('itinerary_data')` → `parseItineraryDays()` in `src/utils/itineraryParser.ts`. No server filter; the parser is the only transform.

### Two silent-drop sites in `parseItineraryDays`

**A. Intra-day dedup (`parseSingleDay`, line 496–506)**
```ts
const key = `${(act.title || '').toLowerCase().trim()}|${(act.startTime || '').trim()}`;
```
Collisions silently drop the duplicate. Two dining cards with the same generic title (e.g. `"Lunch"`) **and** an identical or empty `startTime` will collapse to one. Same hazard if a Day-0 dining card has an empty `startTime` alongside a logistics card with empty `startTime` — they collide on `"|"`.

**B. Inter-day dedup by `dayNumber` (line 595–605) and by `date` (607–616)**
"Keep the entry with more activities." If `itinerary_data.days` contains a duplicate `dayNumber` (regression from per-day chain regen or partial save), the smaller variant — which may carry the meal cards — is discarded silently.

Both sites match the symptom exactly: Payments sees raw rows (no dedup), itinerary parse drops a subset on every read.

### Fix

1. **`parseSingleDay` intra-day dedup — harden the key + tie-breaker.**
   - Replace the key with `category + venue + title + startTime` so two dining cards never collide unless they are the *same* venue at the *same* time.
   - Drop only when the key is genuinely identical AND both items have non-empty `startTime` (skip the dedup when `startTime` is empty — empty-time collisions are the documented Bruges trigger).
   - When a collision is real, prefer the card with a non-empty venue/location over a placeholder; never drop a `category=dining/food/restaurant` card in favor of a non-dining one.

2. **Outer day-dedup — never collapse meal rows.**
   - Before discarding the "loser" duplicate day, salvage any `category=dining/food/restaurant` activity present in it but absent from the keeper (compare by title+startTime), and merge them into the keeper's `activities[]` in chronological order.
   - Same salvage for the `byDate` dedup loop.

3. **Instrumentation kept in (gated by `console.debug`).**
   - In `parseItineraryDays`, log `[itineraryParser] raw days=N raw_dining=K` (count of dining activities across all raw days) and `[itineraryParser] result days=N result_dining=K`. If `result_dining < raw_dining`, log `console.warn` with the diff for production triage. This is the verification signal the user asked for.

4. **Tighten the existing `console.warn` on dedup**: include category and venue so a future regression is loud, not silent.

### Files

- `src/utils/itineraryParser.ts` (only file changed).

No edge-function changes. No DB or RLS changes. No prompt changes.

### Verification

1. Open Bruges trip → all 7 dining cards visible after hard reload, matching Payments.
2. Browser console shows `[itineraryParser] raw_dining=7 result_dining=7` (no diff warn).
3. Unit test added in `src/utils/__tests__/itineraryParser.dining-preservation.test.ts`:
   - Two dining cards with same `"Lunch"` title but different startTimes → both kept.
   - Two dining cards with same title and *empty* startTime → both kept (empty-time collisions exempt).
   - Two days sharing `dayNumber`, one carrying the only dinner → dinner merged into the keeper, not dropped.

### Memory

Append to `mem://constraints/itinerary/data-integrity-and-merging` (the 60% dedup memo) a sentinel that `parseItineraryDays` never drops dining cards: empty-time dedup skip + cross-day dining salvage.
