
# Trip Generation Flight Recorder

Goal: for every generated trip, capture a single inspectable record that answers — *what the user asked for, what each stage did, what the LLM saw, what it returned, what survived validation/repair, what was saved, and did the result match the user's DNA + inputs*.

Today logs are scattered across `console.log` sentinels in 10+ edge functions. They disappear after Supabase's log retention window and can't be cross-referenced. This plan persists everything to the DB, structured, queryable, and viewable in-app.

## What gets captured (per trip, per day)

**Step 1 — User Request (immutable snapshot at generation start)**
- Raw start-form payload: destination(s), dates, travelers, budget tier + cents, pacing, interests, dietary, must-do chips, anchors, hotel/flight selections
- Resolved profile: primary/secondary archetype, trait_scores, travel_dna_overrides (Fine-Tune sliders), `firstTimePerCity`, celebration day
- Computed `meal_policy_at_generation`, generation rules, isFirstTimeVisitor

**Step 2 — Pipeline Stages (per day, ordered)**
For each stage record: `stage_name`, `started_at`, `ended_at`, `duration_ms`, `status` (ok/warn/error/skipped), `inputs_summary`, `outputs_summary`, `mutations` (counts), `notes[]`.

Stages tracked:
1. `compile-facts` — day truth ledger, intents, prior-day context
2. `compile-prompt` — final prompt sent to LLM (full text + token count + model + temperature)
3. `llm-call` — raw LLM response (full JSON), latency, retries, finish_reason
4. `parse-response` — JSON parse, schema validation
5. `validate-day` — every validation code raised (MISSING_DESCRIPTION, LOGISTICS_SEQUENCE, etc.)
6. `repair-day` — every repair action (§1–§16), per-action before/after diff
7. `validation-gate` — drops/blanks per code
8. `enrich-day` — venue enrichment, anchor backfill, cross-city filter
9. `universal-quality-pass` — bookend, meal-guard, fill-dead-gaps decisions
10. `persist-itinerary` — cascade shifts, regression-block decisions, bookend verification
11. `cost-table-sync` — activity_costs writes, parity check
12. `freeze + fully_persisted` — final stamp

**Step 3 — LLM I/O (full fidelity)**
- Prompt: full system + user messages (current sentinels only log lengths)
- Response: full JSON before any mutation
- Stored compressed (gzip) since prompts run 30–80KB

**Step 4 — Mutation Trail**
For every activity that changes between LLM output and final save: `activity_id`, `field`, `before`, `after`, `mutated_by` (stage name), `reason`. This is the answer to "where did Maison Eric Kayser's description disappear?"

**Step 5 — DNA/Input Match Verdict (post-save analyzer)**
Runs once at end of generation. Scores each saved activity against:
- Primary/secondary archetype alignment (categorical match + trait_scores cosine)
- Must-do chip fulfillment (did "Eat at Roscioli" land in the plan? which day? right meal slot?)
- Anchor fulfillment (every required anchor present with time + description?)
- Dietary compliance
- Budget tier match (median per-activity cost vs tier band)
- Pacing match (activities/day vs requested pacing)
- Interest coverage (every selected interest represented ≥1x?)

Output: `match_score` 0–100 + `mismatches[]` array with `{type, expected, actual, day, activity_id, root_cause_stage}`.

The root-cause attribution joins back to the mutation trail — e.g. "Roscioli was in LLM output day 2 but stripped by validation-gate DESCRIPTION_GHOST_REFERENCE in repair-day §10b" gives the user a direct pointer to the failing stage.

## Where it lives

**New table `trip_generation_traces`** (one row per trip generation attempt):
- `id`, `trip_id`, `attempt_number`, `started_at`, `ended_at`, `total_duration_ms`, `final_status`
- `user_request_snapshot` jsonb
- `resolved_profile` jsonb
- `match_verdict` jsonb (score + mismatches)

**New table `trip_generation_stages`** (one row per stage per day):
- `id`, `trace_id`, `day_number`, `stage_name`, `order_index`, `started_at`, `ended_at`, `duration_ms`, `status`, `inputs` jsonb, `outputs` jsonb, `notes` text[], `error` text

**New table `trip_generation_llm_calls`** (one row per LLM call):
- `id`, `trace_id`, `day_number`, `model`, `temperature`, `prompt_gz` bytea, `response_gz` bytea, `prompt_tokens`, `completion_tokens`, `latency_ms`, `finish_reason`, `retry_count`

**New table `trip_generation_mutations`** (one row per field mutation):
- `id`, `trace_id`, `day_number`, `activity_external_id`, `field`, `before_value`, `after_value`, `stage`, `reason`

RLS: trip owner + accepted collaborators can read their own traces. Service role writes.

## Wiring (no behavior changes — pure capture)

Single new module `_shared/trace-recorder.ts`:
```ts
const trace = startTrace(tripId);
trace.stage('compile-prompt', { day: 2 }, async () => { ... });
trace.llm({ prompt, response, model, latency });
trace.mutation(activityId, 'description', before, after, 'repair-day-10b', 'DESCRIPTION_GHOST_REFERENCE');
await trace.finalize(matchVerdict);
```

Wired at: `action-generate-trip-day`, `generate-itinerary` Stage 6, `action-save-itinerary`, every stage helper. Stages wrap their work in `trace.stage(...)` — adds 1 line per call site, no logic change.

Match verdict analyzer = new `_shared/match-verdict.ts`, runs in `persistTripItinerary` after Phase 6 freeze.

## Viewing it

**Admin/debug page `/admin/trip-trace/:tripId`** (gated to trip owner + Voyance staff):
- Header: user request summary + match score + pass/fail badges per category
- Day tabs: timeline of stages with duration bars, expandable to inputs/outputs/notes
- LLM tab: prompt + response side-by-side per day, syntax-highlighted, copy buttons
- Mutations tab: filterable table — "show me everything that mutated `description` on day 2"
- Verdict tab: ranked mismatches with deep-links to the responsible stage

## Storage / cost guardrails

- LLM prompts/responses gzipped (~5× compression on JSON)
- Retain full trace for 30 days, then prune `llm_calls` + `mutations` but keep stage summaries + verdict for 1 year
- Opt-out flag `metadata.trace_disabled` for users who request it
- Estimated ~150KB/trip compressed

## Out of scope (this plan)

- Real-time streaming of traces to UI during generation (next iteration)
- Cross-trip aggregate dashboards ("which stage drops the most activities globally") — once we have data
- Replay/re-run from any stage — needs immutable inputs, design pass first

## Acceptance

After implementation, for any bad trip the user reports, you can answer in <60 seconds:
1. What they asked for
2. What the LLM saw and returned for the failing day
3. Which stage mutated/dropped the broken item
4. Whether the final plan matches their DNA + inputs, and exactly where it diverged
