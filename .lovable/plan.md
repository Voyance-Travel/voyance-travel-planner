

## Decomposing the Monolith: Incremental Pipeline Architecture

### The Problem

`index.ts` is **13,491 lines** containing three massive inline handlers:
- `generate-full` (~2,800 lines, 5028-7810) — legacy full pipeline
- `generate-day` (~4,000 lines, 7815-11821) — single day AI call + post-processing
- `generate-trip-day` (~600 lines, 12910-13491) — **duplicate** of `action-generate-trip-day.ts`

The duplication is the root cause of most bugs. There are TWO implementations of `generate-trip-day` (the extracted 1,048-line `action-generate-trip-day.ts` AND the inline 12910-13491 block in index.ts). The extracted version passes restaurant pools; the inline one doesn't. Hotel rotation bugs, missing restaurant data, and inconsistent sanitization all trace back to this split-brain.

### Architecture Today

```text
index.ts (13,491 lines)
├── Routing switch (~300 lines)
├── generate-full handler (2,800 lines) ← legacy, rarely used
├── generate-day handler (4,000 lines) ← the actual AI call
├── Extracted action delegates (get-trip, save, sync, etc.) ← clean
├── generate-trip inline (600 lines) ← DUPLICATE of action-generate-trip.ts
└── generate-trip-day inline (580 lines) ← DUPLICATE of action-generate-trip-day.ts
```

### Strategy: Extract in Phases, Never Break the Chain

We don't rewrite from scratch. We extract the `generate-day` handler (the 4,000-line core) into its own action file, then delete the inline duplicates. Each phase is independently deployable.

---

### Phase 1: Kill the Inline Duplicates (Zero Risk)

**Goal**: Remove the duplicate `generate-trip` and `generate-trip-day` handlers from index.ts that are already extracted into action files.

**File: `index.ts`**
- Delete lines 12292-12903 (inline `generate-trip`) — already handled by `action-generate-trip.ts`
- Delete lines 12910-13491 (inline `generate-trip-day`) — already handled by `action-generate-trip-day.ts`
- The routing at the top already imports and delegates to these action files, so the inline blocks are dead code that only runs if the extracted handlers are somehow skipped

**Verify**: Confirm the routing switch at the top of the serve handler routes `generate-trip` and `generate-trip-day` to the extracted handlers BEFORE reaching the inline blocks.

**Impact**: ~1,200 lines removed. Eliminates the split-brain where the inline version doesn't pass restaurant pools.

---

### Phase 2: Extract `generate-day` Into Its Own Action File

**Goal**: Move the 4,000-line `generate-day`/`regenerate-day` handler out of index.ts into `action-generate-day.ts`.

**File: `action-generate-day.ts`** (new)
- Move lines 7815-11821 from index.ts
- Import all the same modules it currently uses (prompt-library, truth-anchors, sanitization, etc.)
- Export as `handleGenerateDay(supabase, userId, params)`

**File: `index.ts`**
- Add `import { handleGenerateDay } from './action-generate-day.ts'`
- Replace the 4,000-line inline block with a 3-line delegate

**Impact**: index.ts drops from ~13,500 to ~9,500 lines. The `generate-day` logic becomes independently testable.

---

### Phase 3: Extract `generate-full` Into Its Own Action File

**Goal**: Move the legacy 2,800-line `generate-full` handler out.

**File: `action-generate-full.ts`** (new)
- Move lines 5028-7810 from index.ts
- Export as `handleGenerateFull(supabase, userId, params)`

**Impact**: index.ts drops to ~6,700 lines (just routing + shared types/interfaces).

---

### Phase 4: Split `generate-day` Into Focused Steps

Once `generate-day` is in its own file, break it into composable steps:

**File: `steps/build-day-context.ts`**
- Hotel resolution, flight context, meal policy, restaurant pool injection
- ~800 lines extracted

**File: `steps/build-day-prompt.ts`**
- All prompt assembly (archetype, DNA, dietary, weather, geographic zones)
- ~1,200 lines extracted

**File: `steps/call-ai-and-parse.ts`**
- The actual AI call, JSON extraction, retry logic
- ~600 lines extracted

**File: `steps/post-process-day.ts`**
- Sanitization, dedup, truth anchors, Google Places enrichment, route optimization, meal compliance
- ~1,400 lines extracted

Then `action-generate-day.ts` becomes a ~200-line orchestrator:
```text
context = buildDayContext(params)
prompt  = buildDayPrompt(context)
rawDay  = callAIAndParse(prompt)
result  = postProcessDay(rawDay, context)
return result
```

---

### Phase 5: Dedicated Post-Generation Checks (Your Workflow 3-6)

Once step 4 is done, post-processing becomes easy to reason about because it's isolated:

```text
postProcessDay(rawDay, context):
  1. sanitizeText(rawDay)           — strip AI commentary, phantoms
  2. checkDuplicateActivities()     — trip-wide dedup
  3. checkDuplicateRestaurants()    — meal repeat swap from pool
  4. validatePreferences()          — budget, dietary, pacing
  5. addBuffersAndRoutes()          — travel times, reorder by proximity
  6. enforceMealCompliance()        — inject missing meals
```

Each step is a pure function: takes day data in, returns cleaned day data out. If any step fails, the previous step's output is still valid.

---

### Recommended Execution Order

| Phase | Risk | Lines Removed | Effort |
|-------|------|---------------|--------|
| Phase 1: Kill duplicates | Very low | ~1,200 | Small |
| Phase 2: Extract generate-day | Low | ~4,000 moved | Medium |
| Phase 3: Extract generate-full | Low | ~2,800 moved | Medium |
| Phase 4: Split into steps | Medium | 0 (refactor) | Large |
| Phase 5: Clean post-processing | Low | 0 (refactor) | Medium |

I recommend starting with **Phase 1** immediately — it's the highest-value, lowest-risk change that fixes the restaurant pool and hotel rotation bugs caused by the duplicate code paths.

