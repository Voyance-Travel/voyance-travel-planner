

## Diagnosis: Why the Schema-Driven Pipeline Produces Illogical Itineraries

### The Complete Data Flow (What Actually Happens)

```text
                           WHAT THE AI SEES
                           ================
User Input
    │
    ▼
determineDayType()         → e.g. "morning_arrival"
    │
    ▼
buildBaseSkeleton()        → HARDCODED slot order:
                              0: arrival
                              1: transport (airport→hotel)
                              2: hotel_checkin          ← ALWAYS position 2
                              3: lunch
                              4: activity
                              5: activity
                              6: activity (optional)
                              7: activity (optional)
                              8: dinner
                              9: evening (optional)
    │
    ▼
applyDnaModifiers()        → Adjusts counts, marks optional,
                              moves hotel_checkin down IF
                              hotelPriority=deferred (only "packed" group)
    │
    ▼
fillFlightAndHotelSlots()  → Fills arrival with flight time
                              Fills hotel_checkin with HARDCODED 15:00
                              (line 86: `const checkInTime = input.hotel!.checkInTime || '15:00'`)
                              But does NOT reorder slots
    │
    ▼
fillMustDoSlots()          → Inserts must-do into an activity slot
                              or creates a new must_do slot
                              BUT: hotel_checkin at position 2 with
                              "15:00" is ALREADY FILLED before the
                              must-do at 09:00 gets inserted at position 4+
    │
    ▼
serializeSchemaToPrompt()  → Serializes slots IN POSITION ORDER:
                              1. [CONFIRMED] arrival — 08:15
                              2. [SUGGESTED] transport
                              3. [CONFIRMED] hotel_checkin — 15:00   ← AI sees this THIRD
                              4. [SUGGESTED] lunch
                              5. [CONFIRMED] must_do — 09:00         ← AI sees this FIFTH
                              ...
```

### The 5 Structural Problems

**Problem 1: Skeleton order is never re-sorted by time**

After all fillers run, the slots are in *insertion order*, not *chronological order*. Hotel check-in at 15:00 appears at position 2 (before lunch and the 9 AM must-do). The AI prompt says "use common sense" but the suggested structure lists items in a nonsensical sequence. The AI follows the listed order.

**Problem 2: Prompt describes flat fields, tool schema requires nested objects**

The prompt (schema-to-prompt.ts line 129-141) tells the AI:
```
- cost (number, per person, in USD)
- location (real address or well-known location name)
- personalization (1-2 sentences)
```

The tool schema (index.ts line 8396-8424) requires:
```
- location: { name: string, address: string }
- cost: { amount: number, currency: string, basis: string }
- personalization: { tags: [], whyThisFits: string, confidence: number }
```

The AI gets contradictory instructions. It either returns flat fields (prompt says so) or nested objects (tool schema forces it). The normalizer has to guess which format arrived and often breaks.

**Problem 3: Category enum mismatch**

Prompt says: `dining, sightseeing, entertainment, nightlife, relaxation, shopping, transport, hotel, arrival, departure, free_time`

Tool schema enum: `["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"]`

Missing from tool: `entertainment`, `nightlife`, `hotel`, `arrival`, `departure`, `free_time`
Missing from prompt: `cultural`, `accommodation`, `activity`

The AI is constrained by the tool enum. Dinners become `activity`, arrivals become `transport`, hotels become `accommodation`. The meal dedup logic checks for `cat === 'dining'` and misses dinners labeled `activity`.

**Problem 4: Hotel check-in is always 15:00 regardless of context**

Line 86 of constraint-filler.ts: `const checkInTime = input.hotel!.checkInTime || '15:00'`

When the traveler arrives at 8:15 AM with a 9 AM must-do, the check-in is still filled as 15:00 and placed at position 2 (before activities). The skeleton never considers "this traveler can't check in until after their must-do event."

**Problem 5: Two different tool schemas exist**

Lines 2048-2197: One tool schema (used by old non-schema path) with `minItems: 3`, richer fields (`transportation`, `contextualTips`, `rating`, `website`, `tags`)

Lines 8371-8436: A DIFFERENT, simpler tool schema (used by schema path) — no `minItems`, no `transportation`, no `contextualTips`, missing fields

Both paths use `USE_SCHEMA_GENERATION` to pick the prompt, but BOTH use the tool schema at lines 8371-8436 since the schema path falls through to the same AI call block. The old tool schema at line 2048 is dead code.

---

### Fix Plan (5 changes)

**Change 1: Sort slots chronologically after all fillers** (compile-day-schema.ts, both copies)

After `resolveConflicts()` returns, sort the final slots by their actual time — filled slots by `filledData.startTime`, empty slots by `timeWindow.earliest`. This ensures the AI sees the suggested structure in a logical time sequence. Hotel at 15:00 naturally appears after a 9 AM must-do.

**Change 2: Align prompt output format with tool schema** (schema-to-prompt.ts, both copies)

Replace the "OUTPUT FORMAT" section to describe the exact nested structures the tool schema expects:
- `location: { name, address }` not a flat string
- `cost: { amount, currency, basis }` not a flat number  
- `personalization: { tags, whyThisFits, confidence, matchedInputs }` not a flat string
- `category` enum matches the tool schema exactly

**Change 3: Sync category enum** (schema-to-prompt.ts, both copies)

Change the prompt's category list to match the tool schema: `sightseeing, dining, cultural, shopping, relaxation, transport, accommodation, activity`. Remove `entertainment, nightlife, hotel, arrival, departure, free_time` from the prompt.

**Change 4: Make hotel check-in time-aware** (constraint-filler.ts, both copies)

After filling hotel check-in, if there's a must-do with a start time before the check-in time, change the hotel slot to a "bag drop" (15 min, starting right after transport) and add a deferred "full check-in" slot later in the day (after the must-do ends or at the original 15:00, whichever is later).

**Change 5: Improve meal dedup to use tool-schema categories** (index.ts)

Update `isDiningActivity()` to also check `cat === 'activity'` combined with dining keywords in title/description, since the enum forces the AI to use `activity` for some dining entries.

### Files Changed: 4 (with edge function + src copies)
- `supabase/functions/generate-itinerary/schema/compile-day-schema.ts` + `src/lib/schema-compiler/compile-day-schema.ts` — chronological sort
- `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts` + `src/lib/schema-compiler/schema-to-prompt.ts` — format alignment + category sync
- `supabase/functions/generate-itinerary/schema/constraint-filler.ts` + `src/lib/schema-compiler/constraint-filler.ts` — smart hotel handling
- `supabase/functions/generate-itinerary/index.ts` — meal dedup improvement

