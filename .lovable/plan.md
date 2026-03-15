

## Itinerary Generation Audit: Path Consistency & DNA Uniformity

### Architecture Summary

The generation engine has **two distinct code paths** that should produce identical results for the same DNA/constraints but currently diverge in several ways:

| Path | Entry | Used By |
|------|-------|---------|
| **Path A: `generate-full`** | `action: 'generate-full'` | Legacy full-trip pipeline (rarely used now) |
| **Path B: `generate-trip` → `generate-trip-day` → `generate-day`** | Self-chaining | All current flows: Single City, Multi-City, Just Tell Us, Build It Myself |

Path B is the **active production path**. Path A (`generate-full`) is the legacy 7-stage pipeline. Both paths use `loadTravelerProfile()` as the single source of truth for DNA — this is correct and consistent.

### Verified Consistent (No Gaps)

| Area | Path A | Path B | Match? |
|------|--------|--------|--------|
| DNA loading (`loadTravelerProfile`) | ✅ Stage 1.3 | ✅ Line 8042 | ✅ Same |
| Archetype constraints (`buildFullPromptGuidanceAsync`) | ✅ Stage 1.96 | ✅ Line 8116 | ✅ Same |
| Flight/hotel context (`getFlightHotelContext`) | ✅ Stage 1.4 | ✅ Line 7142 | ✅ Same |
| Budget intent derivation | ✅ `deriveBudgetIntent` | ✅ Via `buildFullPromptGuidanceAsync` | ✅ Same |
| Locked activities | ✅ (via `generateSingleDayWithRetry`) | ✅ Step 1 in generate-day | ✅ Same |
| Multi-city day map | ✅ `prepareContext` | ✅ `generate-trip-day` resolves | ✅ Same |
| Per-city hotel override | ✅ via `multiCityDayMap` | ✅ via `hotelOverride` param | ✅ Same |
| Transition day detection | ✅ via `multiCityDayMap` | ✅ via explicit params + DB resolve | ✅ Same |
| Must-do activities | ✅ via `context.mustDoActivities` | ✅ via `paramMustDoActivities` + metadata | ✅ Same |
| Generation rules | ✅ via `context.generationRules` | ✅ via `paramGenerationRules` + metadata | ✅ Same |
| Trip type modifiers | ✅ `buildTripTypePromptSection` | ✅ `buildTripTypePromptSection` | ✅ Same |
| Collaborator attribution | ✅ Stage 1.2 | ✅ Lines 8186-8238 | ✅ Same |
| Voyance Picks | ✅ Stage 1.93 | ✅ Lines 8163-8182 | ✅ Same |
| AI model used | `gemini-3-flash-preview` | `gemini-3-flash-preview` | ✅ Same |
| Validation + retries | ✅ `validateGeneratedDay` | ✅ Same function | ✅ Same |

---

### Gaps Found

#### GAP 1: `generate-full` Has Enrichment Stages That `generate-day` Skips (MEDIUM)

Path A (`generate-full`) runs these enrichment stages that Path B (`generate-day`) does **not**:

1. **Stage 1.6 — AI Preference Enrichment** (`enrichPreferencesWithAI`): Transforms raw preferences into rich AI guidance. `generate-day` uses only `buildPreferenceContext` (raw structured data).

2. **Stage 1.7 — Past Trip Learnings**: Fetches `trip_learnings` table (highlights, pain points, pacing feedback). `generate-day` never reads this table.

3. **Stage 1.8 — Recently Used Activities**: Queries recent trips to the same destination to avoid repeat venues. `generate-day` has no such check.

4. **Stage 1.9 — Local Events & Travel Advisory** (Perplexity): Discovers festivals, exhibitions, and safety info. `generate-day` skips this entirely.

5. **Stage 1.92 — Hidden Gems Discovery** (Perplexity): 5-layer deep research for local gems. `generate-day` never calls `discover-hidden-gems`.

6. **Stage 1.96 — Personalization Enforcement** (`deriveForcedSlots`, `deriveScheduleConstraints`): Forces trait-based activity requirements per day. `generate-day` does not run these.

**Impact**: Since all production traffic uses Path B (`generate-trip` → `generate-day`), **none of these enrichments are active for any user**. The hidden gems, local events, past trip learnings, AI preference enrichment, and forced personalization slots are dead code in production.

**Fix**: Port the missing stages into the `generate-day` action. These should run once per trip (not per-day) and be stored in trip metadata so each day generation can read them.

---

#### GAP 2: `generate-full` Runs Group Archetype Blending, `generate-day` Does Not (MEDIUM)

Path A runs `blendGroupArchetypes()` (Stage 1.2.1) which:
- Loads companion DNA profiles
- Runs weighted trait score blending (owner 50%, companions 50% split)
- Generates day assignments and conflict resolution
- Saves `blendedDnaSnapshot` to trip record

Path B (`generate-day`) loads collaborators for **attribution** only (suggestedFor prompt) but never blends their DNA traits into the generation. The AI gets the owner's archetype only.

**Impact**: Group trips generated via the production path ignore companion archetypes for activity selection. A "luxury luminary" traveling with a "budget backpacker" gets a luxury-only itinerary.

**Fix**: Run group archetype blending in `generate-trip` (once, before the chain starts) and store the blended profile in trip metadata. `generate-day` should read the blended profile instead of just the owner's.

---

#### GAP 3: `generate-full` Builds Dietary Enforcement Prompt, `generate-day` Does Not (LOW)

Path A calls `buildDietaryEnforcementPrompt()` and injects expanded dietary avoid lists into the system prompt. Path B relies only on the unified profile's `dietaryRestrictions` array through the basic preference context, without the expanded enforcement rules.

**Impact**: Dining activities may not fully respect nuanced dietary restrictions (e.g., "vegetarian" won't trigger expanded avoidance of specific cuisines/ingredients).

**Fix**: Add `buildDietaryEnforcementPrompt()` call to `generate-day`'s system prompt construction.

---

#### GAP 4: `generate-full` Injects Jet Lag, Weather, Trip Duration, Children Prompts; `generate-day` Does Not (LOW)

Path A injects these specialized prompts:
- `buildJetLagPrompt()` — adjusts Day 1-2 energy recommendations
- `buildWeatherBackupPrompt()` — rain plan alternatives
- `buildTripDurationPrompt()` — pacing across long vs short trips
- `buildChildrenAgesPrompt()` — toddler/teen activity filtering
- `buildReservationUrgencyPrompt()` — booking priority signals
- `buildDailyEstimatesPrompt()` — budget tier guidance

None of these are called in `generate-day`.

**Impact**: Production itineraries miss jet lag adjustments, weather backup plans, trip-duration-aware pacing, children-appropriate filtering, and reservation urgency signals.

**Fix**: Add these prompt builders to `generate-day`. Most can be computed once per trip and stored in metadata.

---

#### GAP 5: `generate-full` Runs Post-Generation Personalization Validation; `generate-day` Does Not (LOW)

Path A runs `validateItineraryPersonalization()` across all days, checking:
- Avoid list violations (food dislikes, general avoidances)
- Dietary restriction violations
- Duplicate detection
- Personalization field completeness
- Pace compliance

Path B runs `validateGeneratedDay()` (basic structural validation) but **not** the full personalization validator.

**Impact**: Dietary violations, avoid-list breaches, and missing personalization fields slip through undetected in production.

**Fix**: Run `validateItineraryPersonalization()` per-day within the `generate-day` action, using the profile data already loaded.

---

### Recommendations — Priority Order

1. **Port enrichment stages to `generate-trip` level** (Gaps 1, 2, 4): Run hidden gems, local events, group blending, jet lag, weather, etc. **once** in `generate-trip` and store results in `trip.metadata.generation_context`. Each `generate-day` call reads from this cache.

2. **Add personalization validation to `generate-day`** (Gaps 3, 5): Include dietary enforcement prompt and post-generation personalization validation in the per-day path.

3. **Consider deprecating `generate-full`**: Since all production traffic uses the chain path, the `generate-full` action is dead code. It should either be removed or marked as deprecated to avoid maintenance confusion.

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 1-2, 4 (enrichment caching) | `supabase/functions/generate-itinerary/index.ts` (generate-trip + generate-day actions) |
| GAP 3 (dietary prompt) | `supabase/functions/generate-itinerary/index.ts` (generate-day action) |
| GAP 5 (validation) | `supabase/functions/generate-itinerary/index.ts` (generate-day action) |

