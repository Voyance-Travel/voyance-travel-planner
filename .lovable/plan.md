

## Map Backend Phase Names to User-Friendly Text

### Problem
The generation progress screen shows raw backend phase names like "Pre chain setup" and "Generating day 2" instead of polished user-facing text. The `useRotatingMessage` hook in `GenerationPhases.tsx` (lines 133-138) does a naive `replace(/_/g, ' ')` conversion instead of a proper mapping.

### Change — Single file: `src/components/planner/shared/GenerationPhases.tsx`

**1. Add a `PHASE_DISPLAY_TEXT` map and `getPhaseDisplayText()` function** (above the `useRotatingMessage` hook):

- Static map for known phases: `pre_chain_setup` → "Setting up your trip...", `prompt_built` → "Preparing your personalized plan...", `context_loaded_day_N` → handled dynamically, `generating_day_N` → "Building Day N...", `post_processing` → "Polishing your itinerary...", `enrichment_complete` → "Almost there...", `saving` → "Saving your itinerary...", `done` → "Your itinerary is ready!"
- Dynamic pattern matching for `generating_day_(\d+)` and `context_loaded_day_(\d+)` via regex
- Fallback: title-case the snake_case string + `console.warn` for unknown phases

**2. Replace lines 133-138** in the `useRotatingMessage` hook:

Replace the naive formatting:
```typescript
const phase = data.current_phase
  .replace(/_/g, ' ')
  .replace(/day (\d+)/i, 'Day $1')
  .replace(/^(\w)/, (c: string) => c.toUpperCase());
setLivePhase(phase);
```

With:
```typescript
setLivePhase(getPhaseDisplayText(data.current_phase));
```

**3. Admin page (`GenerationLogs.tsx`) stays unchanged** — admins should see raw phase names for debugging.

### Result
Users see: "Setting up your trip..." → "Building Day 1..." → "Building Day 2 of 5..." → "Polishing your itinerary..." → "Your itinerary is ready!"

Never see: `pre_chain_setup`, `generating_day_2`, `post_processing`, or any snake_case text.

