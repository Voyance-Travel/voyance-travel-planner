

# Fix: Improve Generation Diagnostics and Connection Resilience

## Two distinct problems

### Problem 1: Missing diagnostic data in logs
The `generation_logs` table has `model_used`, `prompt_token_count`, and `completion_token_count` columns, but they're always `nil` at the top level. The data IS present inside `day_timings[].llm` (per-day), but:
- `action-generate-trip-day.ts` calls `timer.addDayTiming()` with LLM diagnostics from `__diagnostics.llm`
- But it never calls `timer.addTokenUsage()` — so `modelsUsed` and token totals stay empty
- `finalize()` therefore writes `null` for `model_used`, `prompt_token_count`, `completion_token_count`

### Problem 2: Client sees "Server request interrupted" on final day
The edge function logs show `Http: connection closed before message completed` — the generation completed successfully (status=ready, sync OK) but the HTTP response couldn't be delivered because the client disconnected. The client sees this as a network error and crashes trying to render incomplete data.

This happens because the full chain (Day 1 → Day 2 → Day 3 + sync + journey trigger) runs inside a single edge function invocation that takes 30+ seconds for the final day. The original client request times out.

## Changes

### 1. Fix token/model aggregation in `action-generate-trip-day.ts`
After each `timer.addDayTiming()` call (there are 2 sites — mid-chain and completion), also call `timer.addTokenUsage()` with the diagnostics LLM data so the top-level summary is populated.

**File**: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- After line ~988 (completion path): add `timer.addTokenUsage(diag1.llm?.promptTokens || 0, diag1.llm?.completionTokens || 0, diag1.llm?.model);`
- After line ~1057 (mid-chain path): add `timer.addTokenUsage(diag2.llm?.promptTokens || 0, diag2.llm?.completionTokens || 0, diag2.llm?.model);`

### 2. Add structured error logging for the connection-closed scenario
When the `Http: connection closed` error occurs, the generation has already completed and the data is saved. The issue is the client doesn't know. Add a console log at the response boundary so it's clear this is a delivery failure, not a generation failure.

**File**: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- After the completion response (line ~1013), add a log with trip status confirmation
- After the chain response (line ~1142), add similar confirmation

### 3. Add per-day LLM model logging to console output
Currently the console only shows timing and category breakdowns. Add the model name to per-day console logs so edge function logs capture which model was used for each day.

**File**: `supabase/functions/generate-itinerary/generation-timer.ts`
- In `finalize()` per-day breakdown (line ~203), include `llm.model` in the log line

### 4. Log AI call details in `ai-call.ts` on success
Currently only errors are logged. Add a success log with model, token usage, and response time.

**File**: `supabase/functions/generate-itinerary/pipeline/ai-call.ts`
- After line ~210 (success return), add: `console.log([ai-call] ✓ Day ${dayNumber}: model=${model}, tokens=${usage.prompt_tokens}+${usage.completion_tokens}, attempt=${attempt})`

## Expected result
- `generation_logs` rows will have populated `model_used`, `prompt_token_count`, `completion_token_count` columns
- Edge function logs will show which LLM model was called for each day and token usage
- Connection-closed errors will be clearly distinguishable from actual generation failures in logs

## Files to modify
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — add `addTokenUsage()` calls
- `supabase/functions/generate-itinerary/pipeline/ai-call.ts` — add success log
- `supabase/functions/generate-itinerary/generation-timer.ts` — include model in per-day log

