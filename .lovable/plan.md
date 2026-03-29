

# Phase 8: Wire Pipeline Logging — AI, Enrich, Meals, Transport

## Problem

Three gaps in the generation logs:

1. **AI call and enrich timings are always zero.** `addDayTiming()` is called with hardcoded `0, 0` for `aiMs` and `enrichMs` because the orchestrator (`action-generate-day.ts`) doesn't return those timings to the trip-level caller (`action-generate-trip-day.ts`).

2. **No meal tracking.** We enforce meals via meal policy and meal guard, but the logs don't record what meals were required, what was found, and whether the guard fired.

3. **No transport tracking.** Transition days inject transport blocks, but logs don't show whether inter-city transport was present or injected as fallback.

## Approach

Rather than wiring the heavyweight `StageLogger` (which writes to trip metadata — a separate persistence path), we enhance the existing `GenerationTimer` + `day_timings` system that already works and persists to `generation_logs`.

### Step 1: Return timing + diagnostics from `action-generate-day.ts`

The response JSON already returns `{ success, day, dayNumber, ... }`. Add fields to the response:

```typescript
{
  success: true,
  day: generatedDay,
  // ... existing fields ...
  // NEW: Pipeline diagnostics
  _diagnostics: {
    aiCallMs: number,
    enrichMs: number,
    meals: {
      required: string[],        // ['breakfast', 'lunch', 'dinner']
      found: string[],           // ['breakfast', 'dinner']
      guardFired: boolean,       // true if meal guard injected
      injected: string[],        // ['lunch']
    },
    transport: {
      isTransitionDay: boolean,
      mode: string | null,       // 'train', 'flight', etc.
      hadInterCityTravel: boolean,
      fallbackInjected: boolean,
    },
    validation: {
      totalChecks: number,
      errors: number,
      warnings: number,
      repairsApplied: number,
    },
  }
}
```

This is collected inside `action-generate-day.ts` as we go — we already have the data, we just need to aggregate it.

### Step 2: Consume `_diagnostics` in `action-generate-trip-day.ts`

Replace the hardcoded `0, 0` in `addDayTiming()`:

```typescript
const diag = dayResponseBody._diagnostics || {};
timer.addDayTiming(
  dayNumber,
  dayGenTotal,
  diag.aiCallMs || 0,
  diag.enrichMs || 0,
  dayResult?.activities?.length || 0,
  dayCats
);
```

### Step 3: Extend `addDayTiming` for meals + transport

Add optional `meals` and `transport` fields to the day timing entry:

```typescript
addDayTiming(day, totalMs, aiMs, enrichMs, activityCount, categories?, meals?, transport?, validation?) {
  const entry = { day, total_ms: totalMs, ai_ms: aiMs, enrich_ms: enrichMs, activities: activityCount };
  if (categories) entry.categories = categories;
  if (meals) entry.meals = meals;
  if (transport) entry.transport = transport;
  if (validation) entry.validation = validation;
  this.dayTimings.push(entry);
}
```

This data flows into `generation_logs.day_timings` (JSONB) — no schema migration needed.

## Files to edit

| File | Change |
|------|--------|
| `action-generate-day.ts` | Track `aiCallMs`, `enrichMs` via timestamps around existing calls. Collect meal/transport diagnostics. Return `_diagnostics` in response. |
| `action-generate-trip-day.ts` | Read `_diagnostics` from day response, pass to `addDayTiming`. |
| `generation-timer.ts` | Extend `addDayTiming` signature to accept optional `meals`, `transport`, `validation` objects. |

## What the logs will show after this

Per-day in `generation_logs.day_timings`:
```json
{
  "day": 1,
  "total_ms": 12400,
  "ai_ms": 8200,
  "enrich_ms": 3100,
  "activities": 8,
  "categories": { "activity": 3, "dining": 2, "transport": 1, "attraction": 2 },
  "meals": { "required": ["breakfast","lunch","dinner"], "found": ["breakfast","lunch","dinner"], "guardFired": false },
  "transport": { "isTransitionDay": false },
  "validation": { "checks": 12, "errors": 0, "warnings": 1, "repairs": 1 }
}
```

## Risk

**Very low.** All changes are additive — new optional fields on existing structures. The `_diagnostics` field uses an underscore prefix to signal it's internal, not user-facing. No DB migration needed since `day_timings` is JSONB.

