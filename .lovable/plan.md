

## Fix: Restore Fun Loading Messages During Generation

### Problem
The `useRotatingMessage` hook in `GenerationPhases.tsx` polls `generation_logs.current_phase` for real-time phase data. The phase values stored are internal pipeline names like `day_1_ai_complete`, `day_1_context_loading`, `day_1_post_processing_complete`. The hook does minimal formatting (underscores to spaces, capitalize first letter) and shows these raw phase names to users, **overriding** the fun rotating `STATUS_MESSAGES` like "Finding hidden gems locals love..." and "Mapping the best dining spots...".

### Root Cause
Line 136-144 in `GenerationPhases.tsx`: when `livePhase` is set (which is almost always during generation), it takes priority over `STATUS_MESSAGES` (line 164: `return livePhase || STATUS_MESSAGES[index]`).

### Fix

**File: `src/components/planner/shared/GenerationPhases.tsx`**

Change `useRotatingMessage` to **not** display raw phase names. Instead, map internal phases to user-friendly messages and keep rotating through the fun messages. The live phase data should only influence *which* fun message to show, not replace them.

**Approach**: Create a mapping function that translates internal phase names into friendly messages, and always fall back to the rotating `STATUS_MESSAGES`. Only use the live phase to determine a contextual message when it maps to something meaningful (e.g., "Day 2 complete" → "Day 2 is looking great!").

```typescript
function humanizePhase(phase: string, destination?: string): string | null {
  // "Day N/M complete" → friendly confirmation
  const completeMatch = phase.match(/day\s+(\d+)(?:\/\d+)?\s+complete/i);
  if (completeMatch) return `Day ${completeMatch[1]} is looking great!`;
  
  // All other internal phases (ai_complete, context_loading, post_processing, etc.)
  // → return null to fall back to fun rotating messages
  return null;
}
```

Update line 136-144 to use this mapper instead of raw formatting:

```typescript
if (data?.current_phase && data.status !== 'completed' && data.status !== 'failed') {
  const friendly = humanizePhase(data.current_phase, destination);
  setLivePhase(friendly); // null → will fall back to STATUS_MESSAGES
} else {
  setLivePhase(null);
}
```

This way internal phases like `day_1_ai_complete` or `day_1_context_loading` no longer leak to the UI. Users see the fun rotating messages ("Finding hidden gems locals love...") with occasional contextual updates ("Day 2 is looking great!") when a day actually completes.

### Summary

| File | Change |
|---|---|
| `GenerationPhases.tsx` | Add `humanizePhase` mapper; stop displaying raw internal phase names; restore fun rotating messages as primary display |

