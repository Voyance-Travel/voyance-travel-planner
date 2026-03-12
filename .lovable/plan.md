

## Gap Analysis: Old Path vs Schema Path

After reading both the old path (lines 1743-2031 system+user prompt) and the new schema path (schema-to-prompt.ts + serializer context wiring at lines 8109-8338), here are the concrete gaps causing illogical output.

### What the OLD path has that the NEW path is MISSING

```text
OLD PATH (systemPrompt + userPrompt)          SCHEMA PATH (schema-to-prompt.ts)
─────────────────────────────────────          ──────────────────────────────────
✅ CORE PRINCIPLE block                       ❌ Missing — no "plan the ENTIRE
   "plan hour-by-hour from waking                day hour-by-hour" instruction
    to sleeping"

✅ General Requirements block                 ❌ Missing:
   - FULL street addresses                       - No "include transit between
   - Transit between EVERY pair                    every pair" rule
   - 3 MEALS per full day                        - No "3 meals per full day"
   - Last activity → next morning                - No next-morning preview
   - Min 3 paid + 2 free + 3 meals               - No minimum paid/free split
   - Evening/nightlife after dinner              - No evening activity mandate

✅ DAY 1 ARRIVAL STRUCTURE                    ❌ Missing — no venue-first
   - Hotel check-in first, OR                     routing logic, no arrival
   - Venue-first routing (must-do                 structure rules at all
     near airport)

✅ LAST DAY structure                         ❌ Missing — no "checkout →
   "Checkout → Transfer → Departure"             transfer → departure" rule

✅ FULL DAY type detection                    ❌ Missing — old path has
   isFullDay = !isFirstDay && !isLastDay          explicit "fill EVERY hour"
   → demands complete hour-by-hour                for middle days

✅ ACTIVITY COUNT with hard limits            ⚠️ Partial — schema path gets
   effectiveMinActivities-                        pacing override but doesn't
   effectiveMaxActivities with                    inject min/max as hard limits
   "going under = FAILURE"                        into the prompt

✅ Retry with previous output                 ❌ Missing — schema path has no
   Sends failed JSON back for                     retry-with-context logic
   focused fix

✅ Budget-down rewrite detection              ❌ Missing — no detection of
   "user asked for cheaper" →                     "cheaper" keywords in
   hard cost ceiling                              dayFocus/rewriteInstructions

✅ Smart Finish anchor preservation           ❌ Missing — no "keep ALL
   "keep ALL user-provided anchor                 anchor activities" rule
   activities by exact name"

✅ Trip type context                          ⚠️ Partial — appended as raw
   (honeymoon, family, solo, etc.)                text in richSections but not
                                                  structured

✅ Transport preference prompt                ⚠️ Partial — same, appended
   (prefer walking, metro, etc.)                  as raw text

✅ Locked slots instruction                   ⚠️ Partial — same, appended
   "DO NOT generate for locked                    as raw text
   time slots"

✅ Timing instructions                        ❌ Missing entirely
   (jet lag, weather backup,
   reservation urgency, daily
   estimates, children ages)

✅ Destination essentials                     ❌ Missing — the DB-driven
   (DB-driven with Perplexity                     essentials prompt is never
   enrichment, freshness checks)                  passed to the serializer

✅ Quality rules (12 numbered)                ❌ Missing — schema path has
   Including "no duplicate back-                  no quality rules block
   to-back", "title naming",
   "dining title = restaurant name"

✅ Voyance intelligence fields                ⚠️ Partial — mentioned in
   (8 detailed fields with examples)              output format but no examples,
                                                  no "at least 1-2 hidden gems
                                                  per day", no "2-3 timing
                                                  hacks per day"

✅ Comprehensive constraints block            ❌ Missing — the full archetype
   (buildAllConstraints output)                   definitions, violations, day
                                                  structure, variety rules

✅ Experience guidance prompt                  ❌ Missing — what TO prioritize

✅ Destination × archetype guide              ❌ Missing — city-specific
                                                  archetype recommendations

✅ Generation hierarchy                       ❌ Missing — the 8-level
   (8 priority levels for                         conflict resolution priority
   conflict resolution)                           chain

✅ Per-archetype budget ceilings              ❌ Missing — no Budget/Economy/
   with exact dollar ranges                       Standard/Comfort/Premium/
                                                  Luxury daily caps

✅ Banned experience types                    ❌ Missing — no "already did
   (already did cooking class →                   cooking class → ban all
   ban culinary workshops)                        culinary workshops"

✅ Operating hours rules                      ⚠️ Partial — mentioned briefly
   + venue hours cache injection                  in "common sense" but no
                                                  venue hours cache injected

✅ Multi-city prompt                          ❌ Missing — no per-city
   (city-specific hotel, visitor                  visitor status, no hotel
   status, transition day builder)                anchoring, no city isolation

✅ Day-of-week awareness                      ❌ Missing — no "today is
   "today is Monday, museums closed"              Monday" awareness
```

### Root Cause

The schema path was designed to REPLACE the old prompt with a cleaner, schema-driven structure. But only ~20% of the old prompt's content made it into the serializer. The schema-to-prompt.ts file is ~326 lines producing a lightweight prompt, while the old path builds ~800+ lines of dense, battle-tested instructions. The schema path produces a "polite suggestion" while the old path produces a "comprehensive battle plan."

### Fix Plan

**Single change: Port the missing old-path content into schema-to-prompt.ts**

Rather than 15 small patches, the fix is to enrich `buildSystemPrompt()` and `buildUserPrompt()` in schema-to-prompt.ts with the missing blocks from the old path. This means adding the following sections to the serializer context and prompt builder:

1. **Core principle** — "plan ENTIRE day hour-by-hour"
2. **General requirements** — full addresses, transit between every pair, 3 meals, evening activity, next-morning preview, min paid/free split
3. **Quality rules** — the 12 numbered rules (no dupes, title naming, dining titles)
4. **Activity count hard limits** — inject `effectiveMinActivities`/`effectiveMaxActivities` as prompt text with "going under = FAILURE"
5. **Generation hierarchy** — the 8-level priority chain
6. **Comprehensive constraints** — the `buildAllConstraints()` output
7. **Experience guidance + destination guide** — `buildExperienceGuidancePrompt()` + `buildDestinationGuidancePrompt()` outputs
8. **Arrival/departure structure** — Day 1 hotel-first vs venue-first routing, last day checkout sequence
9. **Voyance intelligence fields** — full 8-field block with examples and minimums
10. **Timing intelligence** — jet lag, weather, children ages, reservation urgency
11. **Destination essentials** — the DB-driven prompt
12. **Operating hours + venue cache** — day-of-week awareness + cached hours
13. **Budget ceilings** — per-archetype daily caps
14. **Banned experience types** — trip-wide dedup
15. **Multi-city context** — city isolation, per-city visitor status, hotel anchoring

**Implementation approach:**

- Add new fields to `SerializerContext` interface for each missing block (e.g., `coreRequirements`, `qualityRules`, `activityCountLimits`, `generationHierarchy`, `arrivalStructure`, `timingIntelligence`, `destinationEssentials`, `operatingHoursContext`, `budgetCeilings`, `bannedExperienceTypes`, `multiCityContext`, `comprehensiveConstraints`, `experienceGuidance`, `destinationGuide`)
- In `buildSystemPrompt()`, add sections for each new field
- In the wiring block (index.ts lines 8252-8316), populate each new field from the existing variables already in scope (they're all computed before the schema branch)
- Update both copies (edge function + src)

### Files Changed: 3
- `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts` — add ~15 new sections
- `src/lib/schema-compiler/schema-to-prompt.ts` — mirror
- `supabase/functions/generate-itinerary/index.ts` — wire new context fields from existing variables

