## DNA-1 — Trait mapping completeness

### Findings

`OnboardConversation.tsx` lines 135-154 currently map only 7 traits and hardcode `transformation: 3`. The personalization engine expects 8 traits including `cultural` (currently absent — defaults to 0/undefined downstream).

`analysis.whatWorked` / `analysis.whatFailed` are already produced by the conversation-analysis AI step, so deriving `cultural` and `transformation` from keyword signals adds zero new LLM cost.

### Plan

Single-file replacement of the `traitScores` object literal (lines 135-154) in `src/pages/OnboardConversation.tsx`:

1. Introduce a local `clamp` helper bounding values to `[-10, 10]` (canonical engine range).
2. Wrap all 7 existing trait expressions in `clamp(...)` for safety.
3. Add `cultural` derived from `authenticity` plus a keyword scan of `whatWorked + whatFailed` (museum/history/temple/heritage/etc., +1 per hit, capped at +3).
4. Replace hardcoded `transformation: 3` with a derivation combining `authenticity`, `adventure`, and explicit growth/transformation keywords ("changed me", "perspective", "sabbatical", etc., +2 per hit, capped at +4).

Verbatim drop-in from the user's spec.

### Out of scope
- Backend `travel_dna_profiles` schema changes (`cultural_score`/`transformation_score` columns already exist per project memory).
- Re-running personalization for users onboarded before this fix (separate backfill task).
- Tweaking weights — using exactly the values specified.

### Verification
`grep -c "cultural:.*clamp\|transformation:.*clamp" src/pages/OnboardConversation.tsx` ≥ 2.