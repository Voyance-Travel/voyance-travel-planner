# Budget Coach pricing fix: ID match + prompt clarification

Two surgical edits to `supabase/functions/budget-coach/index.ts`.

## Edit 1 — Fuzzy title fallback before LLM cost (line ~567)

Replace the single-line `knownCostCents` lookup with a two-step recovery:
1. Exact `activityCostCentsById.get(sid)` (current behavior).
2. If undefined, iterate `activityTitleById` and bidirectional `includes` match on lowercased trimmed titles (>3 chars). On first non-zero hit, log `[budget-coach] Fuzzy ID recovery: …` and use that cost.
3. Only fall back to LLM-emitted `s.current_cost` when both lookups miss.

Comment block includes the literal phrase `Bidirectional contains check` (acceptance grep).

## Edit 2 — Per-person prompt clarification (lines 371 + 373)

Rewrite the schema `description` strings for `current_cost` and `new_cost` so the LLM is told explicitly to report the per-person value and NOT multiply by traveler count. Both strings contain `PER-PERSON value` and `DO NOT multiply by traveler count` (acceptance greps).

## Out of scope

- No changes to `activityCostCentsById` population logic.
- No changes to swap-application / persist code paths.
- No changes to validation or budget math elsewhere.

## Acceptance

4 greps from the spec pass; post-deploy Rome 2-traveler Coach shows $45/pp Colosseum (not $90/pp) and edge logs may surface `[budget-coach] Fuzzy ID recovery` lines.
