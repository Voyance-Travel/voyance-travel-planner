
# Day Truth Ledger — single source of truth per day

## The problem you're describing

Today there is no single, durable record of "what is true and required for Day N." The pipeline knows things in scattered places:

- User-locked activities live in `itinerary_activities` (DB) and as `userAnchors` in memory.
- Hotel/transition facts are recomputed on the fly inside `compile-day-facts.ts`.
- Closures, holidays, "we already did X yesterday" — **not stored anywhere**. They only exist if the AI happens to remember them inside one prompt.
- "User specifically asked for Peixola on Day 2 dinner" exists as one line in a flat anchor list with no priority, no note, no reason.

So when generation runs again (e.g., regenerate, smart-finish, day-fix), the AI sees a fresh prompt without a structured ledger of inviolable facts, and drifts. That's exactly what you saw with the Lisbon dinners.

The fix is not a bigger prompt. It's **a real per-day record we read before generation and validate after**.

## What we'll build

A new `dayLedger` object — one per day — assembled deterministically before every generation and re-checked after. It is the only thing the AI is allowed to treat as "ground truth."

### Shape

```text
dayLedger[dayNumber] = {
  date, dayOfWeek, city, country,

  hardFacts: {
    hotel: { name, address, checkIn, checkOut },
    transitionDay: { from, to, mode, departTime, arriveTime } | null,
    flight: { ... } | null,
    isFirstDay, isLastDay, isHotelChange,
  },

  userIntent: [
    // EVERY locked / pasted / pinned / chat-extracted activity, with full context
    {
      kind: 'dinner' | 'lunch' | 'activity' | 'spa' | ...,
      title: 'Peixola',
      startTime: '19:30',
      source: 'manual_paste' | 'chat' | 'pinned' | 'edited',
      note: 'User pasted this — DO NOT replace, DO NOT move time',
      priority: 'must',
    },
    ...
  ],

  alreadyDone: [
    // What already happened on prior days, so AI doesn't repeat
    { title: 'Belém Tower', dayNumber: 1 },
    ...
  ],

  closures: [
    // Holidays + known closed-on-this-weekday venues we've already detected
    { reason: 'Most Lisbon museums closed Mondays', applies: ['Gulbenkian', 'MAAT'] },
    { reason: 'Public holiday: Liberation Day (Apr 25)', impact: 'banks/markets closed' },
  ],

  freeSlots: [
    // What the AI is actually allowed to fill, derived from userIntent + hardFacts
    { from: '09:00', to: '13:00' },
    { from: '15:30', to: '19:00' },
  ],
}
```

This is **not** a vibes prompt. It's a deterministic struct compiled before the AI runs.

## Pipeline integration

```text
                 ┌─────────────────────────────────┐
  trip data ───▶ │ compile-day-facts.ts            │
  user anchors   │  (already exists, expand it)    │
  prior days     │                                 │
  holidays       └──────────────┬──────────────────┘
                                ▼
                      ┌──────────────────┐
                      │   dayLedger[N]   │  ← single source of truth
                      └────┬─────────┬───┘
                           │         │
                           ▼         ▼
                  ┌──────────────┐  ┌────────────────────┐
                  │ compile-     │  │ post-gen validator │
                  │ prompt.ts    │  │ (anchor-guard +    │
                  │ injects it   │  │  ledger-check)     │
                  └──────┬───────┘  └─────────┬──────────┘
                         ▼                    ▼
                    AI generation ──────▶ rejects/repairs any
                                          activity that violates
                                          userIntent or closures
```

## Concrete changes

### 1. New module: `supabase/functions/generate-itinerary/day-ledger.ts`
- Pure function `buildDayLedger(facts, anchors, priorDays, holidays) → DayLedger`.
- Computes `freeSlots` by subtracting `userIntent` time blocks + hotel/transit windows from the day window.
- Loads holidays from a small static map (per country) — no API call required for v1; we can wire to a holiday API later.

### 2. Expand `pipeline/compile-day-facts.ts`
- Already loads hotel + locked activities. Add:
  - prior days' activity titles → `alreadyDone`
  - day-of-week + country → match against a static `KNOWN_CLOSURES` table (Mondays in Lisbon = museums, etc.)
  - call `buildDayLedger(...)` and stash on `CompiledFacts.dayLedger`.

### 3. Inject ledger into `pipeline/compile-prompt.ts`
Add a clearly-fenced section near the top of the user prompt:

```text
## DAY TRUTH LEDGER — DO NOT VIOLATE
HARD FACTS:
  - Date: 2026-04-18 (Saturday), Lisbon
  - Hotel: Memmo Príncipe Real (check-in done)

USER LOCKED (must keep exactly as written, do NOT replace, do NOT retime):
  - 13:30 Lunch — Belcanto
  - 15:30 Spa — Serenity Spa Lisbon
  - 19:30 Dinner — Peixola

ALREADY DONE (do NOT repeat):
  - Belém Tower, Pastéis de Belém (day 1)

CLOSURES TODAY:
  - National Tile Museum: closed Saturdays — do NOT schedule

FREE SLOTS YOU MAY FILL:
  - 09:00–13:00
  - 16:30–19:00 (light only — dinner at 19:30)
```

This replaces today's flat `mustDoActivities` strings with a structured, prioritized brief.

### 4. Post-generation `ledger-check.ts`
Runs after `applyAnchorsWin`:
- Every entry in `userIntent` must be present on the right day at the right time. If not → repair (re-inject) + log a warning.
- No activity title may match anything in `alreadyDone` (fuzzy match).
- No activity may match a `closures` entry.
- Any violation triggers a single targeted repair pass (not a full regenerate).

### 5. Persist the ledger
Store `dayLedger` snapshot in `itinerary_days.day_brief` (new JSONB column) so:
- Regenerations always start from the prior ledger, not a fresh extraction.
- The UI can render "What we know about this day" (foundation for future "AI notes" panel).

### 6. Static closures + holidays table
- `supabase/functions/_shared/known-closures.ts` — small hand-curated list per city/country (Lisbon Mondays, Paris Mondays, Istanbul Tuesdays, etc.).
- `supabase/functions/_shared/public-holidays.ts` — Portuguese, Spanish, French, Italian, US, UK, Japanese holidays for 2026 to start. Easy to extend later.

### 7. Tests
- `day-ledger.test.ts` — building, free-slot computation, closure matching.
- Add a Lisbon scenario test in `scenario.test.ts`: 10 days with the exact dinner list → assert all 13 user-intent items are present and unmodified after generation.

## What this does NOT change

- No DB rewrite of user data. Anchors still live where they live.
- No new AI calls. The ledger is deterministic.
- No new credits charged. This is a quality / correctness fix.

## Files touched

- New: `supabase/functions/generate-itinerary/day-ledger.ts`
- New: `supabase/functions/generate-itinerary/ledger-check.ts`
- New: `supabase/functions/_shared/known-closures.ts`
- New: `supabase/functions/_shared/public-holidays.ts`
- New: `supabase/functions/generate-itinerary/day-ledger.test.ts`
- Edit: `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`
- Edit: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- Edit: `supabase/functions/generate-itinerary/pipeline/types.ts` (add `dayLedger`)
- Edit: `supabase/functions/generate-itinerary/action-generate-day.ts` (call ledger-check after anchor-guard)
- Edit: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (same)
- Edit: `supabase/functions/generate-itinerary/scenario.test.ts` (Lisbon dinners regression)
- Migration: add `itinerary_days.day_brief jsonb`

## Why this fixes the Lisbon problem (and the next ten like it)

The previous fix made sure the parser captured the user's dinners. This plan makes sure that even if the parser were perfect tomorrow, the AI cannot quietly drop, retime, or replace them, because:

1. They are listed explicitly under "USER LOCKED — DO NOT VIOLATE" in every prompt.
2. After generation, a deterministic check rejects any output that doesn't contain them.
3. The ledger persists, so a regenerate next week starts from the same truth.

It also generalizes: holidays, closures, "already did this," and per-day notes all live in one structure instead of being re-derived (or forgotten) on each pass.
