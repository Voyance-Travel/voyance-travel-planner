

## Audit Results: All Validators ARE Wired — The Problem Is Elsewhere

### Finding: The validators exist and are correctly wired

After tracing the full pipeline, every validator from Prompts 59-62 is present and correctly positioned in the execution flow. Here's the audit:

| Validator | File | Wired? | Runs Before Save? |
|-----------|------|--------|-------------------|
| Placeholder rejection (P59) | `action-generate-day.ts:461-536` | Yes, inline block | Yes — before enrichment |
| Arrival/departure timing (P60) | `action-generate-day.ts:538-590` | Yes, inline block | Yes — before enrichment |
| Time overlap fixer (P60) | `action-generate-day.ts:639-661` | Yes, inline block | Yes — after locked merge |
| Venue-type price cap (P61) | `action-generate-day.ts:1369-1372` | Yes, called in final pricing loop | Yes |
| Michelin price floor (P61) | `action-generate-day.ts:1369-1372` | Yes, called in final pricing loop | Yes |
| Cross-day dining dedup (P62) | `action-generate-trip-day.ts:930-983` | Yes, inline block | Yes — before save |
| Cross-day non-dining dedup (P62) | `action-generate-trip-day.ts:986-1023` | Yes, inline block | Yes — before save |
| Hotel return (P62) | `pipeline/repair-day.ts:2892+` | Yes, via `repairDay()` call | Yes — `repairDay` runs at line 900 |
| Michelin injection (P61) | `action-generate-trip-day.ts:1736-1851` | Yes, runs on final day | Yes — before final save |
| Casual venue price cap (P61) | `action-generate-trip-day.ts:1727-1731` | Yes, trip-level final guard | Yes |
| Trip-wide restaurant dedup failsafe | `action-generate-trip-day.ts:1447-1682` | Yes, comprehensive failsafe | Yes |

### The Real Problem: Two Separate Pipelines

The codebase has **two independent code paths** for generating a day:

1. **`action-generate-day.ts`** — Called when the orchestrator (`action-generate-trip-day.ts`) invokes `action: 'generate-day'` via HTTP (line ~498). This file has the placeholder rejection, arrival/departure timing, time overlap fixer, and per-activity pricing.

2. **`action-generate-trip-day.ts`** — The orchestrator. It calls `action-generate-day.ts` via HTTP, then applies its own post-processing: validate/repair pipeline, cross-day dedup, Michelin injection, pricing guards, and the dedup failsafe.

Both pipelines run, and both have the validators. The validators are wired.

### So Why Are Bugs Still Appearing?

The most likely causes are:

**A. The validators work but the AI generates SO MANY violations that replacement pools are exhausted.** The fallback restaurant pools are finite (5-8 per city per meal type). On a 5-day trip with 3 meals/day = 15 dining slots, if the AI generates placeholders for many of them, the pool runs out.

**B. The `action-generate-day.ts` HTTP call may fail/timeout**, causing `action-generate-trip-day.ts` to fall back to raw AI output that bypasses the per-day validators. Check lines ~540-545 — if the HTTP call to `generate-day` fails, it likely uses a different fallback path.

**C. The Michelin INJECTION runs only on the LAST day** (line 1853: `if (dayNumber >= totalDays)`). On intermediate days, the trip-level Michelin check doesn't run. The Michelin fallback injection only fires once ALL days are generated, which is correct, but if the final save fails or the chain breaks, it never runs.

### Recommended Action: Add the summary log + verify via edge function logs

Rather than creating new validators or an orchestrator function (which would duplicate existing logic), the fix should be:

1. **Add a generation summary log** at the end of the trip generation in `action-generate-trip-day.ts` (after line ~1894) to confirm validators ran
2. **Check edge function logs** for the most recent Paris trip generation to see if the validators fired and what they caught
3. **Investigate the fallback path** in `action-generate-trip-day.ts` when the HTTP call to `generate-day` fails — this may bypass all per-day validators

### Changes

#### 1. `action-generate-trip-day.ts` — Add generation summary log

After line ~1894 (where it logs completion), add a comprehensive summary:

```
=== TRIP GENERATION SUMMARY ===
City: {destination}, Days: {totalDays}, Type: {tripType}
Validators run: placeholder, timing, overlap, pricing, dedup, hotel-return, michelin
Used restaurants: {count} — {list}
Used venues: {count} — {list}
================================
```

#### 2. `action-generate-trip-day.ts` — Check the fallback/error path

At the catch block around the `generate-day` HTTP call (~line 540+), verify that if the call fails or times out, the fallback path still runs through the validate/repair pipeline. If it doesn't, add the same validators there.

#### 3. Check edge function logs to diagnose the actual failure

Before making more code changes, check the `generate-itinerary` edge function logs for the most recent trip generation. The logs should show `PLACEHOLDER DETECTED`, `ARRIVAL TIMING`, `TIME OVERLAP`, `ACTIVITY DEDUP`, `MICHELIN INJECTION`, etc. If these logs are absent, the validators aren't running — which would point to the fallback path issue.

### Files to edit

| File | Change |
|------|--------|
| `action-generate-trip-day.ts` | Add generation summary log after completion; verify fallback path has validators |

### What we're NOT doing
- Creating a new orchestrator function (would duplicate existing wired logic)
- Moving validators (they're already in the correct positions)
- Adding new validators (all needed ones exist)

