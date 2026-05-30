# Memories

- [Planner DayAssignments → Filler](mem://constraints/itinerary/planner-dayassignments-into-filler) — Orchestrator filters must-dos per Planner trip_plan.dayAssignments; fixedDayNumber preserved as safety net; legacy fallback intact when no trip_plan.
- [Final Commit Gate](mem://constraints/itinerary/final-commit-gate) — resolveCommitGate sole authority for ready/frozen. Server hotel sync, FINAL_ORPHAN_TRANSIT, ±10m flight anchor via isUserOwned, edit-path re-gate, client promotion strip in safeUpdateItineraryData, noRawReadyWrites lint blocks regressions.
