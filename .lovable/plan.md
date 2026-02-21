

# Fix: Ensure Life Stage Question Always Differentiates ME vs RR

## Problem
The life stage question (q19) is required and always shown, but answer option `q19e` ("This doesn't really apply to me") sets `life_stage: "na"`, which means neither Midlife Explorer nor Retirement Ranger gets their life stage bonus. Without that signal, RR wins by 1.4 points due to booster accumulation.

## Solution
Replace the "doesn't apply" answer (`q19e`) with a more useful option that still captures a differentiating signal. Instead of opting out entirely, offer a neutral-but-informative choice like **"Somewhere in between -- I don't fit neatly into a category"** which maps to `life_stage: "mixed"` and provides moderate trait signals that don't strongly favor either ME or RR.

Additionally, add `"mixed"` as a small life stage bonus for Midlife Explorer (since "I don't fit neatly" is more of an established/exploratory mindset than a retiree one).

## Changes

### 1. Update q19e answer in `src/config/quiz-questions-v3.json`

Replace the current "na" escape hatch:

```text
Before:
  q19e: "This doesn't really apply to me."
  traits: { life_stage: "na" }

After:
  q19e: "Somewhere in between -- I don't fit neatly into one stage."
  traits: { life_stage: "mixed", quality_intrinsic: 0.4, flexibility: 0.5 }
```

The added traits give a mild signal toward quality and flexibility -- generic enough to be true for "in-between" people, but enough to give the scoring engine something to work with.

### 2. Add `mixed` life stage bonus to Midlife Explorer

In the Midlife Explorer archetype config:

```text
Before:
  lifeStageBonus: { established: 0.5 }

After:
  lifeStageBonus: { established: 0.5, mixed: 0.3 }
```

This gives ME a 2.4-point boost (0.3 x 8) when life stage is "mixed", enough to flip the 1.4-point deficit into a win.

### 3. Update the archetype matcher type definition

Add `"mixed"` to the `life_stage` union type in `src/services/engines/travelDNA/archetype-matcher.ts`:

```text
Before:
  life_stage: 'early' | 'building' | 'established' | 'free' | 'na';

After:
  life_stage: 'early' | 'building' | 'established' | 'free' | 'mixed' | 'na';
```

## Technical Details

- **Two files modified**: `src/config/quiz-questions-v3.json` and `src/services/engines/travelDNA/archetype-matcher.ts`
- The "na" value is preserved in the type union for backward compatibility (existing quiz responses in the database)
- No algorithm changes -- only config and type updates
- The quiz UX remains the same (5 options, same position, same step)

## Expected Result

| Scenario | Before | After |
|----------|--------|-------|
| life_stage = "established" | ME wins (68.0 vs 65.4) | No change (already passing) |
| life_stage = "free" | RR wins (correctly) | No change |
| life_stage = "na"/"mixed" | RR wins (64.0 vs 65.4) | ME wins via mixed bonus (+2.4 pts) |

**Target: 26/26 (100%)**

