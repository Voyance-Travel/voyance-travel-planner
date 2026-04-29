## Live trace: do user activities reach generation?

We already shipped Prompt 87's fixes plus the stronger `userAnchors` layer. Code-level wiring is verified. To prove it end-to-end on a real trip, I'll add a single tagged trace at three checkpoints, run a trip, and read the logs.

### What I'll add (temporary, removable in one pass)

A unique `[ANCHOR-TRACE]` prefix at three points, so we can grep both the browser console and edge logs and see the data flow in order.

**1. `src/contexts/TripPlannerContext.tsx` — `saveTrip()` (~line 297)**
Right before the upsert payload is built, log:
- `mustDoActivities` length and first 100 chars
- `perDayActivities` count and `[dayNumber, firstChars]` summary
- count of `userAnchors` if present in metadata

**2. `src/hooks/useItineraryGeneration.ts` — `generateItineraryProgressive()` (~line 273) and `startServerGeneration()` (~line 503)**
Right before each `supabase.functions.invoke('generate-itinerary', …)`, log:
- `trip.mustDoActivities` length
- `trip.perDayActivities` count
- the dayNumber being generated (per-day path) so we can match against backend logs

**3. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` and `action-generate-day.ts`**
At the entry of each handler, log:
- `params.mustDoActivities` length
- `params.perDayActivities` count
- `tripMeta.userAnchors` count
- which source won the `params || tripMeta` merge

All logs share the prefix `[ANCHOR-TRACE]` so we can pull them with one grep.

### How we run the test

1. I deploy the two edge functions.
2. You go through "Just Tell Us" with a sample like the Hong Kong/Chengdu/Beijing trip — include explicit per-day items (e.g. "Day 2 7:30 PM Dinner at TRB Hutong", "Day 1 morning panda visit").
3. Hit Confirm & Generate.
4. I pull:
   - browser console: `[ANCHOR-TRACE]` from `code--read_console_logs`
   - edge logs: `[ANCHOR-TRACE]` from `supabase--edge_function_logs` for both `generate-itinerary` invocations.
5. We compare the four checkpoints. If any one shows empty/zero while earlier ones had data, that's the break.

### Decision tree from the trace

```text
Save shows data?  ──no──► break is in chat→state hand-off (Start.tsx onChatDetailsExtracted)
       │ yes
       ▼
Invoke shows data? ──no──► break is in trip object construction in the hook
       │ yes
       ▼
Backend params has data?  ──no──► break is in supabase.functions.invoke serialization
       │ yes
       ▼
Backend lockedCards > 0? ──no──► break is in compile-prompt.ts perDayActivities parsing
       │ yes
       ▼
Anchors-win restored items? ──yes──► AI is dropping them; lockedCards reinjection working
                            ──no──► AI honoring them or restoration logic has a bug
```

### After the trace

- If everything flows correctly: I remove all `[ANCHOR-TRACE]` logs in one cleanup pass and we know the system is working — any remaining "AI overwrote my stuff" reports become a prompt-quality issue, not a data-flow issue.
- If we find a break: I fix it at the exact checkpoint, redeploy, retrace, then clean up.

### Files touched (all reversible)

- `src/contexts/TripPlannerContext.tsx` — 1 console.log in saveTrip
- `src/hooks/useItineraryGeneration.ts` — 2 console.logs (per-day + server paths)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — 1 entry log
- `supabase/functions/generate-itinerary/action-generate-day.ts` — 1 entry log
- Deploy: `generate-itinerary`

No behavior changes. Pure observability.
