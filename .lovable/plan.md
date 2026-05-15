## Problem

`TripHealthPanel` shows two independently-computed numbers in the same header:

- **Trip Completion %** = checklist progress: `(daysPlanned/total + flightsBooked + hotelBooked [+ interCityTransport])` averaged. Measures *what's been added*.
- **Health Score** = `100 − weighted issues` from `analyzeHealth`. Measures *quality of what's there*.

A trip with all days planned but no flights booked legitimately reports **Health: 100** (nothing wrong with the planned content) and **Completion: 67%** (2 of 3 checklist items: days + hotel, no flights). The numbers aren't contradictory — they answer different questions — but the UI presents them side-by-side with no labels distinguishing concept, so users read it as a bug.

## Fix (presentation only — no logic changes)

All edits in `src/components/trip/TripHealthPanel.tsx`.

1. **Relabel the ring + pill so each number names what it measures.**
   - Ring (currently `{completionPct}%` with subtitle `{doneCount}/{totalChecklist} items ready`) → keep number, change subtitle line to `Setup: {doneCount}/{totalChecklist} ready` so "Setup" is the noun the % refers to.
   - Header pill `Health: {healthScore}` → `Plan quality: {healthScore}` (or keep "Health" but add a Tooltip — see step 3). Use the same noun in the expanded "0 issues found" microcopy.

2. **Add a one-line reconciliation hint when the two diverge.**
   When `healthScore >= 95 && completionPct < 100`, render a single muted sentence below the header row inside the expanded view, above the Trip Completion progress bar:
   > "Everything you've added looks good — finish the checklist below to reach 100%."
   And the inverse when `completionPct === 100 && healthScore < 95`:
   > "Setup complete — fix the issues below to raise plan quality."
   This is the missing connective tissue users are asking for.

3. **Tooltips on both numbers** (shadcn `Tooltip`, already in the project):
   - Ring: "Setup progress — flights, hotel, days planned, transport."
   - Health pill: "Plan quality — timing, pacing, gaps, missing meals."

4. **Expanded section headers**: change the existing `Trip Completion` label (line 1021) to `Setup checklist` so the expanded list matches the ring's new subtitle. Add a sibling `Plan quality` mini-header above the issues list with the score and `0 issues found` / `N issues` underneath, mirroring the structure.

## Out of scope

- No change to `analyzeHealth`, `completionFactors`, scoring weights, or which items count toward each.
- No change to other panels or hooks.

## Verification

- Trip with flights missing + clean days → ring shows 67%, pill shows 100, reconciliation line reads "Everything you've added looks good…", no contradiction.
- Trip with all checklist done + 1 timing warning → ring 100%, pill <100, inverse line shows.
- Existing trips with both at 100 → no reconciliation line rendered.