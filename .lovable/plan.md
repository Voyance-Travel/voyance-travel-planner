## M3 — Health engine flags overnight gaps as intra-day gaps

### Diagnosis
`analyzeHealth` in `src/components/trip/TripHealthPanel.tsx` already iterates per-day (line 66 `days.forEach`) and gap detection at lines 137–157 only loops between *consecutive same-day* activities. So the per-day scoping the brief asks for is already in place.

The actual cause of the spurious "7h gap on Day 3" is two leaks that put non-day or wrap-past-midnight rows into the gap loop:

1. **Wrap-past-midnight bookend leak** — a "Return to Hotel" / late-night transit card whose `endTime` rolls past 00:00 (e.g., starts 23:50 on Day 2, ends 00:28) lands in Day 3's `activities` array. When sorted by `startTime`, the late-night card sits before breakfast and produces a fake "Day 3 has 7h gap before Breakfast at 08:30" warning. (Already a known pattern — see mem://constraints/itinerary/bookend-clamp-end-of-day.)
2. **Hotel-return / transit not excluded from gap source** — `realActivities` only filters `['check-in','check-out','hotel','accommodation']`. A bookend card categorized as `transit`/`logistics` slips through and becomes a spurious `prevEnd` anchor.

### Fix (presentation/UI only — `src/components/trip/TripHealthPanel.tsx`)

**1. Tighten `realActivities` for gap purposes** — exclude transit/return/bookend cards from being a gap *anchor*, so the loop only measures gaps between substantive activities:

```ts
const isBookendOrTransit = (a: any) => {
  const cat = (a.category || a.type || '').toLowerCase();
  const title = (a.title || a.name || '').toLowerCase();
  if (['check-in','check-out','hotel','accommodation','transit','transportation',
       'transfer','logistics','commute'].includes(cat)) return true;
  if (/^(return to|walk to|transfer to|drive to|taxi|metro|train|bus|tram)\b/i.test(title)) return true;
  if (/return to (the )?hotel/i.test(title)) return true;
  return false;
};
const gapCandidates = realActivities.filter(a => !isBookendOrTransit(a));
```

**2. Drop wrap-past-midnight rows from the gap pass** — if `endTime < startTime` (HH:MM compare) or `startTime` falls in 00:00–04:59, treat as overnight residue and skip:

```ts
const startM = parseTime(a.startTime || '00:00');
const endM   = parseTime(a.endTime   || a.startTime || '00:00');
const wrapsMidnight = endM > 0 && endM < startM;
const preDawn       = startM < 5 * 60;
if (wrapsMidnight || preDawn) continue;
```

**3. Hard guard against day-boundary leaks** — ensure the loop only ever sees the current `dayNum`'s rows, even if the caller's `day.activities` got polluted:

```ts
const dayScoped = gapCandidates.filter(
  a => (a.dayNumber ?? a.day_number ?? dayNum) === dayNum
);
```

**4. Reaffirm "no gap before first / after last"** — current code already only loops `i → i+1`, so wake-up and sleep windows are never flagged. Add a JSDoc comment documenting this invariant so future edits don't regress.

**5. Same treatment for the buffer/conflict passes (lines 173–225)** — they currently use the unfiltered `activities` array (not even `realActivities`). Switch them to the same `dayScoped` source so an overnight bookend can't fabricate a phantom overlap either.

### Verification
- 3-day Madrid: Day 2 last real activity ends 21:40, Day 3 breakfast 08:30 → no gap warning on Day 3.
- Day 3 with breakfast 08:30 ending 09:30 and dinner 19:00 (no lunch / no afternoon) → still flags the genuine intra-day ~9.5h gap.
- Day with a `Return to Hotel` 23:50→00:28 wrap card → not used as gap anchor, no spurious warning.
- Existing missing-meal / thin-day / overlap / buffer logic unchanged in behavior on clean days.

### Out of scope
No backend / pipeline changes. Bookend wrap-past-midnight at generation time is governed by the existing `BOOKEND_CLAMP` rule (mem://constraints/itinerary/bookend-clamp-end-of-day); this fix only hardens the *consumer* against any residue that still slips through.