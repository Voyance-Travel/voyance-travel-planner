

## Fix: Generation Speed — Targeted Optimizations

### Key Finding: Most parallelization is already done

After reading the actual code, the system **already has**:
- **Parallel day generation** — Stage 2 generates days in batches of 3 via `Promise.all` (line 3249)
- **Parallel venue enrichment** — Both Stage 4 (line 4282) and generate-day (line 10494) process activities in `Promise.all` batches of 3
- **Per-activity timeouts** — 10s timeout per enrichment via `Promise.race` (line 4106)
- **Stage-level time budgets** — 45s for Stage 4, 25s for generate-day enrichment

**The real blocker is a crash, not slowness.** The `effectiveHotelData` variable is used at lines 8869, 9005, 9200, and 9494 in the generate-day handler but is only defined inside `buildDayPrompt()` at line 1610. This causes a `ReferenceError` that crashes Day 2+ generation entirely.

### What this fix does (3 targeted changes)

**1. Fix the crash (critical — unblocks everything)**
Define `effectiveHotelData` in the generate-day handler scope using the same logic as `buildDayPrompt()`:
```typescript
const effectiveHotelData = (hotelOverride?.name)
  ? { hasHotel: true, hotelName: hotelOverride.name, ... }
  : (flightContext?.hotelName
    ? { hasHotel: true, hotelName: flightContext.hotelName, ... }
    : { hasHotel: false, hotelName: 'hotel' });
```
This single addition fixes all 4 crash sites.

**2. Increase batch concurrency (moderate speedup)**
The current BATCH_SIZE of 3 is conservative. With per-activity 10s timeouts already in place:
- Increase `BATCH_SIZE` from 3 → 5 in both Stage 4 enrichment and generate-day enrichment
- Reduce inter-batch delay from 400ms → 100ms (the timeout protection handles slow calls)
- This reduces enrichment time by ~40% without risking rate limits (5 concurrent Google Places calls is well within quotas)

**3. AI call timeout protection**
The generate-day handler already has AbortController timeouts (120s/180s), but add a `Promise.race` wrapper as a safety net for the inner AI call in the generate-day action to prevent infinite hangs.

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Define `effectiveHotelData` in generate-day handler (~line 8545); increase BATCH_SIZE to 5 and reduce delays in Stage 4 enrichment |

### Expected impact

| Change | Effect |
|--------|--------|
| Fix effectiveHotelData crash | **Unblocks Day 2-5 generation entirely** — currently 0% of multi-day trips complete |
| Larger batches + shorter delays | ~40% faster enrichment per day |
| AI timeout safety net | Prevents infinite hangs |

### What we're NOT doing (already implemented)

- Parallelizing venue enrichment (already done with `Promise.all`)
- Parallelizing day generation (already done in batches of 3)
- Prompt trimming (already done — `previousActivities` capped to last 3 days at line 234)

