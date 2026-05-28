---
type: constraint
---

# Planner DayAssignments → Schema Filler

The `selectMustDosForDay()` helper (exported from `schema-filler-orchestrator.ts`) filters the full must-do list to only the entries the Planner assigned to a given day via `trip_plan.dayAssignments[].mustDoSlots[].mustDoRef`.

**Rules:**
- If `tripPlan` is absent or `dayAssignments` is empty → full must-do list (legacy fallback).
- If no assignment exists for `dayNumber` → full must-do list (safety fallback).
- If assignment found → keep only must-dos whose `id` appears in `mustDoSlots[].mustDoRef` **plus** any must-do with `fixedDayNumber === dayNumber` (hard-anchor safety net).

**Observability:** `fillerResult.trace` includes `appliedDayAssignment: boolean` and `assignedMustDoIds: string[]`.
