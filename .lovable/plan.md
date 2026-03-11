

## Fix 22B: Schema-Driven Generation — The Schema Compiler

### Overview
Create a standalone, pure-function schema compiler in `src/lib/schema-compiler/` that deterministically assembles `DaySchema` objects from trip data and traveler DNA. No AI calls, no side effects, no connection to existing generation pipeline. Six new files, zero existing files modified.

### Files to Create (6)

| File | Purpose |
|------|---------|
| `src/lib/schema-compiler/index.ts` | Public API — exports `compileDaySchema` and `CompilerInput` type |
| `src/lib/schema-compiler/compile-day-schema.ts` | Main 7-step compiler: determine day type, load skeleton, apply DNA, fill constraints, resolve conflicts, return `DaySchema` |
| `src/lib/schema-compiler/day-skeletons.ts` | 5 base slot templates (morning arrival, midday arrival, late night arrival, standard, departure) |
| `src/lib/schema-compiler/dna-modifiers.ts` | Adjusts skeleton based on `PatternGroupConfig` — activity counts, meal durations, breakfast requirement, evening slots, unscheduled blocks, hotel priority, time windows |
| `src/lib/schema-compiler/constraint-filler.ts` | Fills arrival/departure/transport/hotel slots with known flight and hotel data; removes slots that don't fit departure constraints |
| `src/lib/schema-compiler/conflict-resolver.ts` | Deduplicates meal types, removes slots past `dayEndTime`, re-indexes positions |

### Implementation
All code is provided verbatim in the prompt. Each file imports only from `@/types/schema-generation`, `@/config/pattern-group-configs`, `@/config/archetype-group-mapping`, or sibling files in the same directory. No existing files are touched.

### Key Design Points
- **`CompilerInput`** interface gathers all needed data (day number, flights, hotel, archetype, travelers) so the compiler is a pure function
- **`determineDayType()`** classifies days by arrival time thresholds (< 11h = morning, < 16h = midday, else late night) or departure status
- **DNA modifiers** trim/expand activity slots to match group range, insert unscheduled blocks for gentle travelers, defer hotel check-in for packed travelers
- **Constraint filler** calculates airport buffer times (90 min domestic, 120 min international) and reverse-engineers departure-day slot availability
- Must-do pre-filling is stubbed — full logic deferred to Fix 22E

### Isolation Guarantee
- Zero imports from `supabase/functions/generate-itinerary/`
- Zero modifications to existing files
- The compiler is callable but called from nowhere — purely "on the workbench"

