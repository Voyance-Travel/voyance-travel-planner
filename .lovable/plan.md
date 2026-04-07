

## Arrival/Departure Timing Enforcement — Inline Post-Generation Fix

### What's Already in Place
The prompt system (`compile-day-schema.ts`) already generates detailed arrival/departure constraints (e.g., "DO NOT plan activities before arrival time"). The AI sometimes ignores these. The fix: add deterministic post-generation enforcement that strips violating activities, just like the placeholder rejection block from Prompt 59.

### Changes

#### 1. `action-generate-day.ts` — Add inline arrival/departure timing enforcement

Insert a new block immediately after the placeholder rejection block (~line 535, before locked activity merge). This block:

- Defines a `timeToMinutes()` helper (or reuses existing `parseTimeToMinutes`)
- On **Day 1 (arrival day)**: Reads `flightContext.arrivalTime24` and calculates `arrivalMinutes + 120` as the earliest allowed non-transport activity. Filters out any activity starting before that threshold (keeping TRANSPORT, FLIGHT, TRANSIT, and hotel check-in)
- On **Last Day (departure day)**: Reads `flightContext.returnDepartureTime24` and calculates `departureMinutes - 180` as the latest allowed non-transport activity. Filters out any activity starting after that threshold (keeping TRANSPORT, FLIGHT, TRANSIT, and hotel check-out)
- Logs every removed activity with `console.warn("ARRIVAL TIMING: ...")` or `console.warn("DEPARTURE TIMING: ...")`

Uses `isFirstDay` and `isLastDay` flags already available in scope, plus `flightContext` already extracted.

#### 2. `action-generate-day.ts` — Add time overlap fixer

After the arrival/departure filter and after locked activity merge, add a sequential overlap fixer:

- Sort activities by start time
- For each consecutive pair, if `prev.endTime > curr.startTime`, shift `curr` forward to `prev.endTime + 15 minutes`
- Cascade end times accordingly
- Log each shift with `console.warn("TIME OVERLAP: ...")`

#### 3. `compile-prompt.ts` — Strengthen arrival/departure rules at prompt top

Add a concise reinforcement block right after the existing "REAL RESTAURANTS ONLY" rule at the top of the system prompt:

```
ARRIVAL/DEPARTURE TIMING (TOP PRIORITY):
- Day 1: NEVER generate activities before {arrivalTime} + 2 hours
- Last Day: NEVER generate activities after {departureTime} - 3 hours
```

This uses the already-available `flightContext` values to inject specific times.

### Files to edit

| File | Change |
|------|--------|
| `action-generate-day.ts` | Add arrival/departure filter block + time overlap fixer after placeholder rejection (~line 535) |
| `pipeline/compile-prompt.ts` | Add concise arrival/departure timing reminder at top of system prompt |

### What we're NOT changing
- `compile-day-schema.ts` — already generates correct constraints
- The validate/repair pipeline — stays as secondary safety net
- Meal policy derivation — already accounts for arrival/departure times

