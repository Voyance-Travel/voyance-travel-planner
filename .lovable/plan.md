## RS.L11 — Behavior metadata schema enforcement

Add a whitelist-based sanitizer for metadata in `src/services/behaviorTrackingService.ts` to prevent arbitrary keys (and prompt-injection–shaped strings) from being persisted to `user_enrichment.metadata`.

### 1. Add helper near top of file (after `normalizeEntityId`)

```ts
const ALLOWED_METADATA_KEYS = new Set([
  // Core event context
  'page', 'referrer', 'feature', 'action', 'target',
  // Trip context
  'trip_id', 'destination', 'day_number', 'activity_id',
  // Search context
  'query', 'result_count', 'selected_index',
  // Timing
  'duration_ms', 'time_to_action_ms',
  // User segment
  'tier', 'archetype', 'cohort',
  // Existing internal callers in this file
  'source', 'category', 'reason', 'weight', 'stage', 'abandoned_at',
]);

function sanitizeMetadata(raw: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) {
      console.warn('[behaviorTracking] Dropping non-whitelisted metadata key:', key);
      continue;
    }
    if (typeof value === 'string' && /(?:ignore previous|system prompt|SYSTEM:|<\|im_start\|>)/i.test(value)) {
      console.warn('[behaviorTracking] Dropping suspicious metadata value for key:', key);
      continue;
    }
    if (typeof value === 'string' && value.length > 500) {
      clean[key] = value.slice(0, 500);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}
```

Note on whitelist: the spec list omits keys this file already writes (`source`, `category`, `reason`, `weight`, `stage`, `abandoned_at`). Adding them prevents the sanitizer from silently dropping legitimate internal tracking. Out of scope: `last_interaction_at`, `first_interaction_at`, `interaction_history` are server-derived and merged after sanitization, so they don't need to be whitelisted.

### 2. Wrap user-supplied metadata at the two insert/update sites

`trackEnrichment` (around lines 120–153) is the single low-level writer; sanitize `event.metadata` once at the top of the function so both branches benefit:

```ts
const safeMeta = sanitizeMetadata(event.metadata);
```

Then replace `...event.metadata` (lines 126, 130, 149) with `...safeMeta` and `{ at: now, ...safeMeta }`.

This covers all higher-level callers (`trackDestinationSearch`, `trackDestinationInterest`, `trackCategoryInteraction`, etc.) since they all funnel through `trackEnrichment`.

### 3. Verify

```
grep -c "sanitizeMetadata\|ALLOWED_METADATA_KEYS" src/services/behaviorTrackingService.ts
```
Expect ≥ 2 (definition of set + helper + 1 call site = 3+).

### Files touched
- `src/services/behaviorTrackingService.ts` — add helper, sanitize once inside `trackEnrichment`.
