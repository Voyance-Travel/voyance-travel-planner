

# Enhanced Generation Logs: Meals, Transport & LLM Tracking

## What changes

### 1. Add per-day LLM model tracking to `_diagnostics` (action-generate-day.ts)
The AI model name is already captured via `addTokenUsage(... aiResult.model)` at the trip level, but not included in the per-day `_diagnostics` object. We'll add `model` and `tokens` to the `_diagnostics` response so each day's log entry records which model was called and token counts.

**File:** `supabase/functions/generate-itinerary/action-generate-day.ts`
- Add `model`, `promptTokens`, `completionTokens` fields to the `_diagnostics` object (~line 1038)
- Capture from `aiResult.model` and `aiResult.usage`

### 2. Pass LLM info through to `addDayTiming` (action-generate-trip-day.ts)
The `addDayTiming` calls at lines 984 and 1052 already pass `meals` and `transport` from diagnostics. We'll also pass the new `llm` field.

**File:** `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- At both `addDayTiming` call sites, add the LLM diagnostics as a 5th optional parameter

### 3. Extend `GenerationTimer.addDayTiming` to accept LLM info (generation-timer.ts)
Add an optional `llm` parameter to the method signature and include it in the day timing entry.

**File:** `supabase/functions/generate-itinerary/generation-timer.ts`
- Add `llm?: { model: string; promptTokens: number; completionTokens: number }` parameter
- Store in the day timing entry

### 4. Enhance admin UI to show meals, transport & LLM per day (GenerationLogs.tsx)
Expand the `DayTimingsTable` component to render the meals, transport, and LLM columns that are already stored in the `day_timings` JSONB but currently hidden.

**File:** `src/pages/admin/GenerationLogs.tsx`
- Update `GenerationLog` type to include `meals`, `transport`, `llm` in day_timings entries
- Add columns: Meals (required/found/guard fired), Transport (mode, transition day), LLM (model name, tokens)
- Show meal guard warnings with colored indicators
- Show which model was used per day

## Summary of data flow

```text
action-generate-day.ts  →  _diagnostics { meals, transport, llm }
                        ↓
action-generate-trip-day.ts  →  timer.addDayTiming(..., meals, transport, llm)
                             ↓
generation-timer.ts  →  day_timings JSONB in generation_logs table
                     ↓
GenerationLogs.tsx   →  renders meals/transport/LLM columns per day
```

No database schema changes needed — all data fits in existing JSONB columns.

