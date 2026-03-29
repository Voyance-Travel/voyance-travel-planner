

# Phase 6: Extract Enrichment + Post-Processing

## Current State

`action-generate-day.ts` is at **1,361 lines** (down from ~2,900). Phases 1-5 are complete. The remaining blocks are all post-AI-call processing:

| Block | Lines | Size | Extraction candidate? |
|-------|-------|------|-----------------------|
| AI call + retry | 176–321 | ~145 | Yes → `pipeline/ai-call.ts` |
| Parse + normalize | 345–428 | ~80 | Stays (tightly coupled to AI response) |
| Locked merge + semantic dedup | 432–477 | ~45 | Stays (small, depends on lockedActivities) |
| Enrichment + opening hours | 478–684 | ~200 | Yes → `pipeline/enrich-day.ts` |
| Auto route optimization | 686–695 | ~12 | Stays (single call) |
| Must-do overlap + backfill | 697–856 | ~160 | Partial — could move to repair |
| Transition day fallback | 861–1005 | ~145 | Stays (complex, uses many locals) |
| Validate + repair call | 1009–1176 | ~170 | Already wired, stays as orchestration |
| Persist call | 1182–1204 | ~22 | Already extracted |
| Attribution backfill | 1237–1256 | ~20 | Stays (tiny) |
| Meal final guard | 1264–1332 | ~70 | Stays (needs DB, small) |

## What to extract

### 1. AI Call + Retry → `pipeline/ai-call.ts` (~145 lines)

```typescript
export async function callAI(input: {
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  dayNumber: number;
  toolSchema: object;
  maxAttempts?: number;
}): Promise<AICallResult>
```

Encapsulates: model selection, retry with backoff, fallback model after 3 failures, error classification (429/402/5xx), response validation. Returns raw `data` object or throws typed errors.

### 2. Enrichment + Opening Hours → `pipeline/enrich-day.ts` (~200 lines)

```typescript
export async function enrichAndValidateHours(input: {
  activities: any[];
  destination: string;
  date: string | undefined;
  lockedActivities: any[];
  supabaseUrl: string;
  supabaseKey: string;
  googleMapsApiKey: string;
  lovableApiKey: string;
}): Promise<any[]>
```

Encapsulates: Google Maps enrichment with time budget, opening hours validation (shift/remove logic), confirmed-closure removal. Returns the processed activities array.

## What stays in the orchestrator

- Parse + normalize (~80 lines) — needs `sanitizeGeneratedDay` and activity normalization, tightly coupled
- Locked merge + semantic dedup (~45 lines) — small, uses `lockedActivities` from facts
- Auto route optimization (~12 lines) — single import + call
- Must-do overlap/backfill (~160 lines) — uses `mustDoEventItems` from prompt, complex insertion logic
- Transition day fallback (~145 lines) — uses many resolved variables from facts
- Validate/repair call (~170 lines) — orchestration of pipeline modules
- Attribution + meal guard (~90 lines) — small, needs DB

## Expected outcome

Monolith drops from **1,361 → ~1,010 lines**. Two new pipeline modules added.

## Execution order

1. Create `pipeline/ai-call.ts` — extract AI call + retry + error handling
2. Create `pipeline/enrich-day.ts` — extract enrichment + opening hours validation
3. Wire both into `action-generate-day.ts`
4. Update `.lovable/plan.md`

## Risk

**Low.** Both blocks are self-contained with clear input/output boundaries. The AI call block has no side effects beyond the HTTP call. The enrichment block reads from Google Maps and `verified_venues` but doesn't write.

