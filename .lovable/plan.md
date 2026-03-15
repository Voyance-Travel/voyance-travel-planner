

## DNA-Sourced Itinerary Generation: Current State & Gaps

### How DNA Currently Flows Into Generation

The production path (`generate-trip` → `generate-day`) correctly sources DNA through a unified pipeline:

```text
generate-trip (once per trip)
  ├── loadTravelerProfile() → archetype, traits, dietary, avoid, interests
  ├── Enrichment context computed:
  │     dietary prompt, jet lag, weather, children, duration,
  │     group blending, past learnings, recently used, forced slots
  └── Stored in trip.metadata.generation_context

generate-day (per day)
  ├── loadTravelerProfile() again → owner's archetype + traits
  ├── buildFullPromptGuidanceAsync(archetype, traitScores)
  │     → Archetype constraints, experience affinity, budget rules,
  │       matched attractions, destination guides
  ├── Reads generation_context from metadata → injects enrichment prompts
  ├── validateItineraryPersonalization() → strips critical violations
  └── Collaborator attribution (suggestedFor) for group trips
```

This is consistent across Single City, Multi-City, and all planning modes. The path does NOT change based on mode — verified correct.

### What's Working Well (No Gaps)

- **DNA loading**: `loadTravelerProfile()` is the single source of truth, called in both `generate-trip` and `generate-day`
- **Archetype resolution**: Clear 4-level priority chain (canonical → v2 blob → v2 matches → legacy)
- **Trait scores**: Normalized 8-axis system (pace, budget, social, planning, comfort, authenticity, adventure, cultural) with fallback chain
- **Anti-caricature rules**: Archetype influences 30-40% of activities, not 100%
- **Personalization validation**: Running in `generate-day` with critical violation stripping
- **Group blending**: Computed in `generate-trip`, stored in `generation_context`, injected per-day
- **All enrichment prompts**: Dietary, jet lag, weather, children, duration, reservation urgency — all computed and injected

### Gaps Found

#### GAP 1: `generate-day` Uses Owner Traits for Guidance, Ignores Blended Traits (HIGH)

At line 8157-8164, `buildFullPromptGuidanceAsync` is called with the **owner's** `traitScores.pace` and `traitScores.budget`. Even though group blending computes `blendedTraitScores` and stores them in `generation_context`, **`generate-day` never reads them back** for the guidance builder.

This means: the `groupBlendingPrompt` text is injected (telling the AI about the group), but the **archetype constraints, experience affinity, and budget rules** are all built from the owner's traits alone. The structural guardrails (max activities, pacing, budget ceiling) ignore companions.

**Fix**: In `generate-day`, after reading `generation_context`, check if `gc.blendedTraitScores` exists. If so, use those blended values instead of the owner's raw `traitScores` when calling `buildFullPromptGuidanceAsync` and `getFullArchetypeContext`.

#### GAP 2: No Blended Archetype for Prompt Guidance (MEDIUM)

`buildFullPromptGuidanceAsync` takes a single `archetype` string — always the owner's. For group trips, the archetype-level constraints (avoid list, day structure, experience affinity) only reflect the owner.

Example: Owner is "zen_seeker" (avoid extreme sports), companion is "adrenaline_architect". Current system blocks all adventure activities because zen_seeker's avoid list says "no extreme sports" — companion's preferences never override the structural constraints.

**Fix**: When `generation_context` has group blending data, determine a "group-consensus archetype" or relax the avoid list to only enforce items shared across ALL travelers' archetypes. This requires a small function: `resolveGroupArchetype(ownerArchetype, companionArchetypes)` that picks the least restrictive overlapping constraints.

#### GAP 3: `user_preferences` Table Not Loaded in `generate-trip` Enrichment (LOW)

The `generate-trip` enrichment block (line 10921) loads the traveler profile but doesn't load `user_preferences` for the forced slots computation. At line 11152, it calls `getUserPreferences()` for `travel_companions` — but the profile-loader's `extractInterests()` already reads `user_preferences.interests` and `travel_vibes`. If `getUserPreferences` fails silently, the forced slots lose companion context.

This is a minor inconsistency — the profile-loader covers the critical fields, and forced slots only use `travel_companions` from this table.

**Fix**: No code change needed. Just document that forced slots may not detect children if `travel_companions` is empty but trip has 3+ travelers.

#### GAP 4: Regenerate-Day Doesn't Re-Read Updated `generation_context` (LOW)

If a user adds a companion after initial generation, then regenerates a single day, the `generation_context` in metadata still reflects the original generation (no group blending). The day regeneration will miss the new companion's DNA.

**Fix**: When `regenerate-day` is called, check if the collaborator list has changed since `generation_context` was computed. If so, recompute the enrichment context before regenerating.

---

### Implementation Plan

**Priority 1 — Use blended traits in generate-day guidance (GAP 1)**
- File: `supabase/functions/generate-itinerary/index.ts` (generate-day action, ~line 8060-8165)
- After reading `generation_context`, extract `gc.blendedTraitScores`
- If present, create `effectiveTraitScores` from blended values instead of owner's `traitScores`
- Pass `effectiveTraitScores` to `buildFullPromptGuidanceAsync` and `getFullArchetypeContext`

**Priority 2 — Relax avoid-list for group trips (GAP 2)**
- File: `supabase/functions/generate-itinerary/index.ts` (generate-day action)
- When `gc.blendedDnaSnapshot` exists with multiple travelers, load each traveler's archetype avoid list
- Only enforce avoid items that appear in ALL travelers' lists (intersection, not union)
- Add this relaxed avoid list to the system prompt

**Priority 3 — Stale context detection on regenerate-day (GAP 4)**
- File: `supabase/functions/generate-itinerary/index.ts` (generate-day action, near line 8060)
- Compare current collaborator count vs `gc.blendedDnaSnapshot.travelers.length`
- If mismatch, recompute enrichment context inline before proceeding

