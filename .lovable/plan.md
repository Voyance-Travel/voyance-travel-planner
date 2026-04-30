# Day Brief Unification — Single Source of Truth Per Day

You're right. The Day Truth Ledger I just shipped is the **storage layer**, but the **capture layer** is fragmented across four entry points and the **enforcement layer** has no final spot-check. Three things need to land for the polish to stop failing.

## The Three Gaps

**1. Capture (4 entry points → 1 bucket)**

| Entry point | Today | Fix |
|---|---|---|
| Chat Planner paste | Parses Day N (just fixed) | ✅ already feeds ledger |
| Fine-Tune notes (textarea) | Trip-wide blob → global prompt | Parse for "Day N" / dates / "tonight" → split into per-day intents |
| Manual Add card | Writes activity row, no `note` field for intent | Optional "user wants" reason captured to ledger |
| Assistant chat ("ramen tonight") | Ephemeral, lost on regen | New `record_user_intent` tool → writes to `day_brief` |

**2. Context (ledger payload is too thin)**

Today's ledger has hard facts, locked items, already-done, static closures, holidays. Missing:
- `weather` (rain → swap walking tour)
- `events` (marathon, festival → street closures)
- `transit_disruptions` (metro strike)
- `prayer_times` (Muslim destinations / Ramadan)
- `trip_forward_state` (don't put 3 fado nights back-to-back)
- `user_constraints_for_day` (per-day budget, mobility flag)

**3. Spot-checker (the final polish)**

`ledger-check.ts` exists but only runs at save time and only checks closures + locked items. It does NOT verify:
- Every `userIntent` item actually appears in the final day
- Already-done items aren't repeated
- Forward-state vibe-clashes (two fancy dinners back to back)
- Holiday/closure matches reality post-generation

## What To Build

### A. `day_brief` as the single bucket (DB)

The migration I shipped added `itinerary_days.day_brief jsonb`. Expand its shape:

```ts
day_brief: {
  date, dayOfWeek, city, country,
  hardFacts: { hotel, transit, flight, isFirstDay, isLastDay },
  destination_facts: {
    holidays: [...],
    closures: [...],
    events: [...],          // NEW — fed by destination_events table or AI enrichment
    weather: { summary, rain_prob, temp },  // NEW — fetched at gen time
    prayer_times: [...],    // NEW — only for relevant destinations
    transit_disruptions: [] // NEW — best-effort
  },
  user_explicit_requests: [  // unified across all 4 entry points
    { source: 'chat_paste'|'fine_tune'|'manual'|'assistant',
      kind: 'dinner'|'activity'|'avoid'|...,
      title, startTime?, note, priority: 'must'|'should',
      capturedAt }
  ],
  user_constraints: { dietary, mobility, budget_for_day },
  trip_history: [{ title, dayNumber, kind }],
  trip_forward_state: [{ dayNumber, kind, vibe }]  // next 1–2 days
}
```

### B. Capture pipeline — wire the 4 entry points

1. **Fine-Tune textarea** — new `parseFineTuneIntoDailyIntents()` in `_shared/`. Recognizes:
   - `"Day 3: ..."`, `"April 19: ..."`, `"on Sunday: ..."`
   - `"tonight"` / `"tomorrow"` resolved against trip dates
   - Trip-wide notes (no day marker) → applied to every day's `user_constraints` block
2. **Manual Add card** — add optional "Why / note" field; persists to the activity row AND the day's `user_explicit_requests`.
3. **Assistant chat** — add a `record_user_intent` tool to `itinerary-chat`. When the user says "ramen tonight," the assistant calls it with `{dayNumber, kind:'dinner', title:'ramen', priority:'must'}`. This writes to `day_brief.user_explicit_requests` *immediately*, even before regeneration.
4. **Chat Planner paste** — already feeds the ledger via the userAnchors fix.

All four converge in `compileDayBrief()` (rename of current `buildDayLedger`).

### C. Context enrichment

- `_shared/destination-events.ts` — small static seed (Lisbon Santo António, NYC marathon, etc.) + read from a future `destination_events` table.
- `_shared/weather-fetch.ts` — best-effort call (open-meteo, no key) for the trip date range, cached on the trip row.
- `_shared/prayer-times.ts` — only activated for flagged destinations.
- `trip_forward_state` — derived in-process by peeking at days N+1 and N+2 inside `compileDayBrief()`.

### D. Prompt injection

Update `compile-prompt.ts` to render `day_brief` as a **DAY BRIEF — DO NOT VIOLATE** block at the top of every per-day prompt, with explicit sections:
```
DAY BRIEF — Day 3, Sunday April 19, Lisbon
HARD FACTS: Hotel = X. No transit.
WEATHER: 18°C, 80% rain afternoon.
CLOSURES: Most museums closed Sundays. Holiday: none.
USER REQUIRED (DO NOT DROP):
  - Dinner 8:15 PM at JNcQUOI Asia (source: chat_paste)
  - User said "ramen for lunch" (source: assistant)
ALREADY DONE (DO NOT REPEAT): Belém Tower (Day 2), Pastéis de Belém (Day 2)
TOMORROW HAS: Fancy dinner at Belcanto → keep tonight casual
USER CONSTRAINTS: Vegetarian, $200/day food cap.
```

### E. Spot-checker (final polish)

Promote `ledger-check.ts` to a **two-stage** validator:

1. **Pre-save check** (already exists, expand): every `user_explicit_requests[priority='must']` must have a matching activity in the day. If missing → targeted repair (insert it) instead of just logging.
2. **Post-generation polish pass** — new `runDayBriefSpotCheck()` runs once after the full itinerary generates:
   - For each day, walk the brief and assert every must-item is present.
   - Check forward-state vibe clashes (≥2 consecutive splurge dinners → flag).
   - Check repeats against `trip_history`.
   - Run **one** AI repair call per failing day with the brief + current day → return corrected day.
   - Cap at 2 retries per day to bound credits.

This is the "spot checker" — it runs once, deterministically, after AI is done, and is the layer that's missing today.

## Files

**New**
- `supabase/functions/_shared/parse-fine-tune-intents.ts` (+ test)
- `supabase/functions/_shared/destination-events.ts`
- `supabase/functions/_shared/weather-fetch.ts`
- `supabase/functions/_shared/prayer-times.ts`
- `supabase/functions/generate-itinerary/day-brief-spotcheck.ts` (+ test)

**Edited**
- `supabase/functions/generate-itinerary/day-ledger.ts` → expand to full `DayBrief` shape, add `forward_state` derivation
- `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts` → wire fine-tune parser, weather, events
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` → render the new `DAY BRIEF` block
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` → invoke spot-checker after save
- `supabase/functions/generate-itinerary/ledger-check.ts` → upgrade to targeted repair for missing must-items
- `supabase/functions/itinerary-chat/index.ts` → add `record_user_intent` tool
- `src/components/itinerary/AddActivityDialog.tsx` (or equivalent) → add optional "note / why" field
- `src/components/...FineTune...tsx` (find the textarea owner) → no change needed; parsing is server-side

**Migration**
- Add columns to `itinerary_days`: nothing new (reuse `day_brief jsonb`).
- Optional: `trips.weather_cache jsonb` to avoid refetch.

## Out of scope (call out)

- Real-time transit disruption feeds → stub for now, return `[]`.
- Prayer times only activated for flagged destinations (Morocco, UAE, Indonesia, etc.) — not a global feature.
- The Manual Add "note" field is optional UI; if you'd rather skip the UI change, we keep manual-add silent and rely on its activity row appearing in `userIntent` automatically.

## Verification

- Lisbon-dinners regression test extended: paste the full Lisbon list, regenerate, assert every dinner survives in `day_brief.user_explicit_requests` AND in the final saved day.
- Fine-tune parser test: 12 phrasings ("Day 3", "April 19", "Sunday", "tonight", trip-wide).
- Spot-check test: synthetic day missing a must-item → spot-check inserts it.
- Forward-state test: two splurge dinners in a row → flagged and one downgraded.

Approve and I'll build it. If you want to descope, the highest-leverage subset is **(B) capture pipeline + (E) spot-checker** — those alone close 80% of the polish gap.
