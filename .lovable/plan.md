

## Fix: Day 3 Hotel Transition Scramble, Trip-Wide Duplicates, and Dinner Duration

### Problems Identified

**1. Trip-wide duplicate venues (Skinlife Wellness, Belcanto)**
The cross-day dedup system detects duplicates via `validate-day.ts` (`checkDuplicateConcept`) and repairs them in `repair-day.ts` Step 4. However, the detection relies on `previousDays` — the activities from already-generated days. Since days are generated sequentially (Day 1, then Day 2, then Day 3...), a venue appearing on Day 1 should be caught when generating Day 3. The issue is likely that the **restaurant pool swap** at repair Step 4 (line 390-438) only works for dining, while non-dining duplicates (like Skinlife Wellness) are simply **stripped** (line 441-457), potentially leaving a gap. Additionally, the `conceptSimilarity` function may not be catching short names like "Belcanto" if the 60% word-overlap threshold is too lenient for single-word names.

**2. Hotel transition scramble on Day 3 (Four Seasons → Palácio Ludovice)**
The split-stay repair logic (Steps 7/8, lines 718-924) correctly detects `isHotelChange` and injects Checkout → Transport → Check-in. However, it can get scrambled when the AI *also* generates its own checkout/check-in activities referencing incorrect hotels. The name-matching logic at lines 732-736 checks `prevHotelLower` substring match, which can fail for partial names or if the AI used a different name variant.

**3. Belcanto dinner duration unrealistically short**
The minimum duration enforcement (line 1693-1697) only triggers during time-overlap cascade (Step 13) when a dining activity overlaps with a structural card. There is **no standalone guard** that enforces minimum dining durations of 60 minutes regardless of overlaps. A dinner generated with 30 or 45 minutes stays untouched if nothing overlaps it.

### Fix Plan

#### Fix A: Standalone Minimum Duration Guard (repair-day.ts)
Add a new repair step (after Step 13, or as Step 13b) that scans all activities and enforces minimum durations **independently of overlaps**:
- Dining: 60 minutes minimum
- Activities/sightseeing: 30 minutes minimum

For any activity below its minimum, extend its `endTime` to meet the minimum. Then re-run the overlap cascade to resolve any new conflicts.

**Location:** `repair-day.ts`, new step after the TIME_OVERLAP CASCADE block (~line 1780)

#### Fix B: Strengthen Single-Word Dedup Matching (validate-day.ts)
The `conceptSimilarity` function uses 60% word-overlap, which is unreliable for single-word venue names like "Belcanto". Add an **exact normalized match** check for short names (≤2 words): if both concepts are short and match exactly after normalization, flag as duplicate.

**Location:** `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — in `checkDuplicateConcept`, add exact-match guard for short concepts before the word-overlap check.

#### Fix C: Non-Dining Duplicate Swap from AI Context (repair-day.ts)
Currently, non-dining duplicates are simply stripped (line 441-442). Instead, before stripping, attempt to keep the time slot and mark it for AI re-fill on retry. On the final attempt (smart finish), strip as today. This is lower priority — stripping is acceptable as a fallback.

**No change needed here** — the current strip behavior is acceptable. The real fix is Fix B ensuring detection works.

#### Fix D: Hotel Name Matching Robustness (repair-day.ts)
The split-stay checkout/check-in name matching uses simple `includes()` on lowercased strings. For multi-word hotel names like "Four Seasons Hotel Ritz Lisbon", the AI might generate "Four Seasons" or "Ritz" — partial matches that fail.

Improve the matching: extract the **core hotel name** (first 2-3 significant words, stripping "Hotel", "Resort", etc.) and use that for matching. This prevents the wrong-checkout removal from misfiring, and ensures the correct-checkout detection doesn't miss valid cards.

**Location:** `repair-day.ts`, lines 723-736 and 783-797 — add a `normalizeHotelName` helper.

### Specific Changes

**1. repair-day.ts — Step 13b: Standalone Minimum Duration Enforcement (~line 1780)**

```typescript
// --- 13b. MINIMUM DURATION ENFORCEMENT ---
for (let i = 0; i < activities.length; i++) {
  const act = activities[i];
  const cat = (act.category || '').toLowerCase();
  const startMins = parseTimeToMinutes(act.startTime || '');
  const endMins = parseTimeToMinutes(act.endTime || '');
  if (startMins === null || endMins === null) continue;
  const duration = endMins - startMins;

  const minDur = (cat === 'dining' || cat === 'food' || cat === 'restaurant') ? 60
    : ['activity', 'sightseeing', 'cultural', 'entertainment'].includes(cat) ? 30
    : 0;

  if (minDur > 0 && duration < minDur && !lockedIds.has(act.id)) {
    act.endTime = minutesToHHMM(startMins + minDur);
    act.durationMinutes = minDur;
    repairs.push({
      code: FAILURE_CODES.TIME_OVERLAP,
      activityIndex: i,
      action: 'enforced_minimum_duration',
      before: `${act.title} was ${duration}min`,
      after: `${act.title} now ${minDur}min`,
    });
  }
}
```

Then re-run the overlap cascade loop (or place this step *before* Step 13 so the cascade handles any new overlaps).

**2. validate-day.ts — Short-name exact match in `checkDuplicateConcept` (~line 570)**

Before the word-overlap loop, add:
```typescript
// Exact match for short venue names (1-2 words)
const actWords = actConcept.split(/\s+/).filter(Boolean);
if (actWords.length <= 2 && actConcept.length >= 4) {
  if (previousConcepts.has(actConcept) || previousDiningVenues.has(actConcept)) {
    results.push({ code: FAILURE_CODES.DUPLICATE_CONCEPT, severity: 'error', ... });
    continue;
  }
}
```

**3. repair-day.ts — Hotel name normalization helper (~line 720)**

```typescript
const normalizeHotelCore = (name: string): string => {
  return name.toLowerCase()
    .replace(/\b(hotel|resort|suites?|inn|lodge|palace|boutique|luxury)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
};
```

Update matching at lines 735-736 and 795-796 to use substring matching on the normalized core name.

### Files to Edit
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — minimum duration guard + hotel name normalization
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — short-name exact dedup match

### Impact
- Dinner (and all dining) guaranteed ≥60 minutes — fixes Belcanto duration issue
- Single-word venue names like "Belcanto" and "Skinlife" reliably caught as trip-wide duplicates
- Hotel transition cards correctly reference the right hotels even with name variants
- No behavioral change for trips without these edge cases

