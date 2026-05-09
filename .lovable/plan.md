## Status: Bug #4 already shipped — only a stale flag remains

The repair + gate handlers requested by option (a) are already implemented and live, from the previous round (the same turn that wired `applyValidationGate` into the multi-day path).

### What's already in place

**[repair-day.ts §10d (lines 2857–2881)](supabase/functions/generate-itinerary/pipeline/repair-day.ts:2857)** — for each `SUSPICIOUS_DUPLICATE_PRICE` result, blanks the second card's `cost.amount`, `estimatedCost.amount`, `price_per_person`, `estimated_price_per_person`, and `price` to `0`, logging a `cleared_duplicate_price` repair entry. Locked IDs exempt. Downstream snapshot then re-prices from `cost_reference`.

**[validation-gate.ts case (lines 139–151)](supabase/functions/generate-itinerary/pipeline/validation-gate.ts:139)** — final safety net mirroring §10d for any duplicate-price result that survives repair (e.g. a third occurrence in a triplet).

**[validate-day.ts (line 1041)](supabase/functions/generate-itinerary/pipeline/validate-day.ts:1041)** — already `severity: 'critical'`, with the deterministic-source skip-list (`bar_cap_repair | fine_dining_floor | user | user_override | booked`) so genuine floor/cap matches don't false-positive.

### The single remaining defect

[validate-day.ts:1045](supabase/functions/generate-itinerary/pipeline/validate-day.ts:1045) still reports `autoRepairable: false`. That's no longer true — repair-day §10d auto-repairs it. The stale flag misleads dashboards/telemetry into thinking these need human intervention.

### Change

**[supabase/functions/generate-itinerary/pipeline/validate-day.ts](supabase/functions/generate-itinerary/pipeline/validate-day.ts)** — line 1045:

```ts
autoRepairable: true,
```

No other code or test changes. The existing repair + gate path already covers the runtime behavior; this just makes the metadata consistent.

## Verification
- `npm run typecheck` — clean.
- `cd supabase/functions && deno test --allow-all generate-itinerary/__tests__/` — no test relies on `autoRepairable: false` for this code; existing duplicate-price tests should keep passing.
- Logs: `[VALIDATION_GATE]` and `[repair-day] cleared_duplicate_price` already fire. No log shape change.

## Out of scope
- No new "halve the price" fallback (rejected — `cost_reference` re-snapshot is the right source of truth, and halving an already-suspect price compounds the error).
- No demotion to `'info'` — the swap-path leak in audit reports is real enough that we want repair, not silence.
