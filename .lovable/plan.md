

## Remaining Gaps in the Schema-Driven Generation System

After carefully reviewing the full codebase — the schema compiler modules, the integration wiring in `index.ts`, the existing pipeline's data flows, and the serializer — I've identified **one major gap category** with sub-gaps. The 12 compiler gaps (22F-22K) are all resolved. What remains is the **integration wiring gap**: the compilerInput and serializerContext built in `index.ts` (lines 8000-8088) are missing data flows for features the compiler now supports.

---

### Gap 13: Integration Wiring — compilerInput missing 4 data flows

The compiler supports mustDos (22E), preBookedCommitments (22I), multi-city/transition (22J), and keepActivities (22K), but **none of these are passed** in the compilerInput at lines 8000-8047.

**What's missing from compilerInput:**

| Field | Source in existing pipeline | Status |
|---|---|---|
| `mustDos` | `scheduledMustDos` from `parseMustDoInput()` / `scheduleMustDos()` | NOT WIRED |
| `preBookedCommitments` | `context.preBookedCommitments` (from trip metadata) | NOT WIRED |
| `isMultiCity` | `context.isMultiCity` | NOT WIRED |
| `isTransitionDay` | `dayCity?.isTransitionDay` (from multiCityDayMap) | NOT WIRED |
| `transitionFrom/To` | `dayCity?.transitionFrom/To` | NOT WIRED |
| `transitionMode` | `dayCity?.transportType` | NOT WIRED |
| `transitionDepartureTime/ArrivalTime` | Not directly available (would need extraction) | NOT WIRED |
| `destinationHotel` | Per-city hotel from `dayCity` or `trip_cities` | NOT WIRED |
| `keepActivities` | `currentActivities` / `lockedActivities` (from request body) | NOT WIRED |

**Impact:** When the flag is flipped, must-dos are silently dropped, pre-booked commitments ignored, multi-city trips treated as single-city, and regeneration wipes all kept activities.

---

### Gap 14: Serializer Context — Missing Rich Prompt Sections

The existing pipeline injects ~15 rich prompt sections that the schema serializer doesn't include. The serializerContext (lines 8052-8088) passes empty strings for `bookingRules`, `tipInstructions`, `personalizationInstructions`, and `hiddenGemInstructions`.

**Missing prompt content:**

1. **Dietary enforcement** — `dietaryEnforcementPrompt` (cuisine/ingredient avoidance)
2. **Children/family context** — `childrenAgesPrompt` (toddler/teen activity rules)
3. **Jet lag awareness** — `jetLagPrompt` (energy adjustment for first days)
4. **Weather/season** — `weatherBackupPrompt` (indoor alternatives)
5. **Trip duration rules** — `tripDurationPrompt` (pacing across short/long trips)
6. **Transport preferences** — `transportPreferencePrompt` (car/metro/walk preferences)
7. **Celebration day** — special handling for birthdays/anniversaries
8. **Voyance picks** — founder-curated must-includes
9. **Operating hours enforcement** — conservative timing defaults
10. **Daily budget estimates** — `dailyEstimatesPrompt`
11. **Output quality rules** — clean text, field requirements
12. **Contextual tips** — typed tip instructions (timing, booking, safety, etc.)
13. **Intelligence fields** — `crowdLevel`, `isHiddenGem`, `hasTimingHack`, `voyanceInsight`
14. **Accommodation notes / practical tips** — Day 1 only arrays

**Impact:** Schema-generated prompts would be dramatically less personalized and produce lower quality output.

---

### Gap 15: Validator + Logger Not Called in Flag Branch

`validateAgainstSchema` and `buildGenerationLog` exist in the schema modules but aren't invoked in the flag branch (lines 7993-8098). The AI response goes directly to `finalSystemPrompt`/`finalUserPrompt` without schema-aware validation or logging.

---

### Recommended Fix Order

| Fix | Scope | Complexity |
|---|---|---|
| **22L** — Wire compilerInput (Gap 13) | `index.ts` lines 8000-8047 only | Medium |
| **22M** — Enrich SerializerContext (Gap 14) | `schema-to-prompt.ts` + `index.ts` | Large |
| **22N** — Wire validator + logger (Gap 15) | `index.ts` flag branch | Small |

**22L should come first** — it ensures the compiler actually receives the data it now knows how to handle. 22M is the largest effort (porting prompt richness) and can be done incrementally. 22N is quick but depends on understanding the AI response format.

