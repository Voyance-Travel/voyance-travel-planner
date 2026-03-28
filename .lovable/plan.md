

## Enhance Generation Logging: LLM Model, Token Counts, Categories, Inner Phase Timing

The timer infrastructure exists but is only half-wired. The expensive inner work (AI call, parsing, enrichment) inside `index.ts` is not instrumented, and the model/token/category data is never recorded.

---

### What's Missing Today

| Data Point | DB Column Exists? | Currently Logged? |
|---|---|---|
| Which LLM model is called | Yes (`model_used`) | No |
| Token counts (prompt/completion) | Yes (`prompt_token_count`, `completion_token_count`) | No |
| Per-phase timing inside generate-day | Yes (`phase_timings`) | Only outer `day_N_total`, not inner AI/enrich/parse |
| Activity categories per day | No | No |

---

### Changes

**1. Wire timer into `index.ts` generate-day action (~line 2200)**

Pass `generationLogId` through the `generate-day` request payload from `action-generate-trip-day.ts`. Inside `index.ts`, reconstruct the timer and wrap the key phases:

- `ai_call_day_N` — the main Gemini 3 Flash call (~line 2201)
- `parse_response_day_N` — JSON parsing of AI output
- `venue_enrichment_day_N` — Google Places + GPT-5-nano semantic verification (~line 3720)
- `cost_estimation_day_N` — pricing logic
- `bookend_validation` — the post-processing validator

This gives the waterfall chart real per-phase bars instead of just one `day_N_total` block.

**2. Record LLM model name**

After the AI call completes, write `model_used: 'google/gemini-3-flash-preview'` to the generation_logs row. Since venue verification also uses `openai/gpt-5-nano`, track both in a new `models_used` JSONB field (or append to `phase_timings` metadata).

Simpler approach: add the model name to each phase key, e.g. `ai_call_day_1 [gemini-3-flash]`, so it shows in the waterfall naturally.

**3. Record token counts**

The Lovable AI gateway returns `usage.prompt_tokens` and `usage.completion_tokens` in the response. After the AI call, parse these from the response and accumulate them. On `finalize()`, write totals to `prompt_token_count` and `completion_token_count`.

**4. Track categories per day**

Add a `category_breakdown` field to each `day_timings` entry:
```json
{ "day": 1, "total_ms": 62000, "ai_ms": 45000, "enrich_ms": 8000, "activities": 8,
  "categories": { "dining": 3, "activity": 2, "transport": 2, "nightlife": 1 } }
```

After parsing the AI response, count activities by category and include in `addDayTiming()`.

---

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/generation-timer.ts` | Add `addTokenUsage()` method, extend `addDayTiming()` to accept categories, write token totals in `finalize()` |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Pass `generationLogId` in the `generate-day` request body; count categories from `dayResult.activities` before calling `addDayTiming()` |
| `supabase/functions/generate-itinerary/index.ts` | Import timer, reconstruct from logId in generate-day action, wrap AI call / parse / enrichment / cost phases with `startPhase`/`endPhase`, extract token counts from AI response |

### Migration

None needed — `model_used`, `prompt_token_count`, and `completion_token_count` columns already exist. Category data goes inside the existing `day_timings` JSONB.

