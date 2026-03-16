

## Fix: Enforce Must-Do Fulfillment with Retry + Injection

### The Problem

Must-do activities (landmarks the user checked, custom items they typed) are injected into the AI prompt with strong language ("NON-NEGOTIABLE", "FAILURE = ITINERARY REJECTION"), but **there is zero enforcement**. Both validation points — the per-day retry loop (Stage 2) and the post-generation check (Stage 2.8) — are explicitly tagged as "logging only." If the LLM drops "Champagne at the Eiffel Tower," the system logs a warning and moves on.

Meanwhile, the system **does** enforce and retry for:
- Missing meals (meal guard + retry)
- Activity count too low (retry)
- Time gaps > 3 hours (retry)
- Budget violations (retry)
- Smart Finish density (retry)

Must-dos deserve the same treatment.

### Root Cause

`validateMustDosInItinerary` exists and works correctly — it identifies missing must-dos by name. But its output is never wired into the retry loop or a post-hoc injection mechanism.

### The Fix (Two Layers)

**Layer 1: Per-Day Retry Loop (Stage 2) — Must-Do Check**

In the per-day generation retry loop (~line 2698-2870), after the existing validation checks, add a must-do presence check for the current day:

1. Parse `context.mustDoActivities` into `MustDoPriority[]` (already done at line 2698 as `mustDoList`, but only as a flat string array)
2. Use `parseMustDoInput` to get the full scheduled must-dos
3. Filter to must-dos assigned to the current `dayNumber`
4. Run `validateMustDosInItinerary` against just this day's activities
5. If any are missing → push to `validation.errors` with the specific names → triggers retry with focused error message telling the AI exactly what it forgot

This means the AI gets up to 3 attempts to include the must-do, with each retry explicitly naming what's missing.

**Layer 2: Post-Generation Injection (Stage 2.8) — Safety Net**

If after all retries a must-do is still missing from the full itinerary:

1. For each missing must-do, find its scheduled day from `scheduleMustDos`
2. Inject a placeholder activity into that day with:
   - The must-do's exact name as the title
   - Its scheduled time slot
   - Category inferred from the must-do type
   - A flag like `"source": "must_do_injection"` so the frontend can optionally style it
3. Re-sort the day's activities chronologically after injection

This guarantees 100% must-do presence — either the AI includes it naturally (Layer 1), or the system forces it in (Layer 2).

### Matching Logic Improvement

The current `validateMustDosInItinerary` matching requires ALL words to appear in the activity title. "Champagne at the Eiffel Tower" would need "champagne", "at", "the", "eiffel", "tower" all in one title. If the AI titles it "Eiffel Tower Champagne Experience", the word "at" is missing → false negative.

Fix: Filter out stop words (at, the, a, an, in, on, to, for, of, and, with) from the search terms before matching, and also try matching if 80%+ of significant words match.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-itinerary/must-do-priorities.ts` | Improve `validateMustDosInItinerary` matching: strip stop words, add 80% fuzzy threshold, add substring containment check |
| 2 | `supabase/functions/generate-itinerary/index.ts` (~line 2698) | In the per-day retry loop, add must-do presence validation that pushes to `validation.errors` for the current day's assigned must-dos |
| 3 | `supabase/functions/generate-itinerary/index.ts` (~line 6368) | Upgrade Stage 2.8 from "logging only" to injection: for any must-do still missing after full generation, inject a placeholder activity into the correct day |

### What This Does NOT Change

- Normal generation (no must-dos) is completely unaffected
- The prompt language stays the same — it already says the right things
- Must-do parsing, scheduling, and priority assignment are untouched
- The retry budget stays at 3 attempts per day — we're just adding one more check to the existing validation pass

