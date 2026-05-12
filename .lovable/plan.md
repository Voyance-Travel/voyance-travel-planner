# Fix: hotel-return bookend injecting on departure day

## Problem
After the read-time bookend safety net was added, it now appends "Return to {hotel}" on the departure day too — so after the flight card, the UI shows the traveler going back to the hotel they no longer occupy.

## Root cause
`src/utils/itineraryParser.ts` (~line 754–762) detects the departure day by looking only at the **last array element** of the **last day**:

```ts
const lastCard = lastDayActs[lastDayActs.length - 1];
const departureDayIdx = (lastCard is flight/airport) ? lastDayIdx : -1;
```

If anything is positioned after the flight in array order (a stale leisure card the editor never resorted, a previously-persisted synthetic return, or simply non-chronological storage), `lastCard` is not the flight, `departureDayIdx` stays `-1`, and `ensureHotelReturnBookend` is called with `isDepartureDay: false` for every day. It then dutifully appends a hotel return after the departure flight.

`ensureHotelReturnBookend` itself has the same blind spot — `isDepartureTerminal(last)` only inspects the single last element, so its internal guard doesn't catch this either.

## Fix
Two small, surgical changes — both in frontend display code, no business logic, no DB writes.

### 1. `src/utils/itineraryParser.ts` (Step 4b)
Replace the "last card of last day" detection with: **any day whose activities contain a flight or airport/terminal/gate transport card is a departure day.** Use the latest such day index to mark the departure (handles multi-leg trips defensively, but in practice it's just the last day).

```ts
const isDepartureDay = (acts: any[]) => acts.some(a => {
  const cat = String(a?.category || '').toUpperCase();
  const title = String(a?.title || a?.name || '');
  if (cat === 'FLIGHT' || /\b(flight|departure)\b/i.test(title)) return true;
  if (/TRANSPORT|TRANSIT|TRAVEL|LOGISTICS/.test(cat) &&
      /\b(airport|terminal|gate|station)\b/i.test(title)) return true;
  return false;
});
let departureDayIdx = -1;
for (let i = result.length - 1; i >= 0; i--) {
  if (isDepartureDay(result[i].activities || [])) { departureDayIdx = i; break; }
}
```

### 2. `src/lib/itinerary/ensureHotelReturnBookend.ts` (defense in depth)
Before the existing terminal/last-card scan, scan the **whole day** for a flight or airport-transfer card. If one is present, treat the day as a departure and skip injection — even if `opts.isDepartureDay` was not passed.

```ts
const hasDepartureTerminal = activities.some(isDepartureTerminal);
if (hasDepartureTerminal) {
  console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped reason=day_contains_departure_terminal`);
  return activities;
}
```

This makes the parser's caller-side flag a hint, not a hard requirement — and closes the bug for any future call site that forgets to pass `isDepartureDay`.

## Tests
Add two cases to `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts`:

- Flight card present but **not** the last array element → no bookend injected.
- Airport-transfer card mid-array followed by a stale leisure row → no bookend injected.

## Out of scope
- Generator/repair-day logic
- DB writes / persisted bookends
- The "duplicate hotel-return" issue (separate dedup pass already shipped)
- Any cost/snapshot work

## Verification
Reload the affected trip — departure-day flight should be the last visible card with no "Return to {hotel}" trailing it. Non-departure days continue to show their hotel return.