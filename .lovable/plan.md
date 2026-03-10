

## Display Name Sweep — Remaining Files

This is a find-and-replace sweep across ~8 files, changing old archetype display names to new ones while preserving all slugs/IDs.

### Rename Map

| Old Display Name | New Display Name |
|---|---|
| Digital Explorer | The Untethered Traveler |
| Collection Curator | The Passport Collector |
| Status Seeker | The VIP Voyager |
| Flexible Wanderer | The Wildcard |
| Retreat Regular | The Wellness Devotee |
| Community Builder | The Purpose Voyager |
| Eco Ethicist | The Mindful Voyager |
| Gap Year Graduate | The Horizon Chaser |
| Sabbatical Scholar | The Immersion Seeker |
| Healing Journeyer | The Restoration Seeker |
| Retirement Ranger | The Boundless Explorer |
| Midlife Explorer | The Rediscovery Traveler |
| Bucket List Conqueror | The Milestone Voyager |

### File-by-File Changes

**1. `supabase/functions/generate-itinerary/trip-type-modifiers.ts`**
- Line ~2223: "Bucket List Conqueror" → "Milestone Voyager"
- Line ~2608: "Flexible Wanderer" → "Wildcard"
- Line ~2789: "Retirement Ranger" → "Boundless Explorer"
- Line ~2790: "Gap Year Graduate" → "Horizon Chaser"
- Line ~3183: "Retreat Regular" → "Wellness Devotee"
- Line ~3539: "Bucket List Conqueror" → "Milestone Voyager"
- Line ~3579: "Gap Year Graduate" → "Horizon Chaser"
- Line ~3716: "Retreat Regular" → "Wellness Devotee"

**2. `supabase/functions/generate-itinerary/personalization-enforcer.ts`**
- Line ~62: comment "Status Seeker" → "VIP Voyager"
- Line ~64: comment "Digital Explorer" → "Untethered Traveler"
- Line ~282: comment "STATUS SEEKER" → "VIP VOYAGER"
- Line ~315: comment "DIGITAL EXPLORER" → "UNTETHERED TRAVELER"

**3. `supabase/functions/generate-itinerary/archetype-constraints.ts`**
- Line ~1698: "Retreat Regular" → "Wellness Devotee"
- Line ~1775: "Flexible Wanderer" → "Wildcard" (in anti-gaming naming rules)

**4. `supabase/functions/parse-travel-story/index.ts`**
- Line ~16: "The Flexible Wanderer" → "The Wildcard"
(All other entries in this file are already updated)

**5. `src/lib/archetypeTeasers.ts`**
- Line ~73: name "Retreat Regular" → "The Wellness Devotee"
- Line ~89: name "Flexible Wanderer" → "The Wildcard"

**6. `src/lib/strangerCopy.ts`**
- Line ~78: name "Flexible Wanderer" → "The Wildcard"

**7. `src/config/quiz-questions-v3.json`**
12 name replacements in the archetype definitions section (~lines 1361-1760):
- "Digital Explorer" → "The Untethered Traveler"
- "Flexible Wanderer" → "The Wildcard"
- "Community Builder" → "The Purpose Voyager"
- "Bucket List Conqueror" → "The Milestone Voyager"
- "Collection Curator" → "The Passport Collector"
- "Status Seeker" → "The VIP Voyager"
- "Retreat Regular" → "The Wellness Devotee"
- "Gap Year Graduate" → "The Horizon Chaser"
- "Midlife Explorer" → "The Rediscovery Traveler"
- "Sabbatical Scholar" → "The Immersion Seeker"
- "Healing Journeyer" → "The Restoration Seeker"
- "Retirement Ranger" → "The Boundless Explorer"

**8. `docs/TRAVEL_ARCHETYPES.md`**
Update all display names in lines 68-252:
- Line 68: "The Digital Explorer" → "The Untethered Traveler"
- Line 102: "The Community Builder" → "The Purpose Voyager"
- Line 112: "The Bucket List Conqueror" → "The Milestone Voyager"
- Line 128: "The Collection Curator" → "The Passport Collector"
- Line 136: "The Status Seeker" → "The VIP Voyager"
- Line 154: "The Retreat Regular" → "The Wellness Devotee"
- Line 204: "The Eco Ethicist" → "The Mindful Voyager"
- Line 214: "The Gap Year Graduate" → "The Horizon Chaser"
- Line 222: "The Midlife Explorer" → "The Rediscovery Traveler"
- Line 230: "The Sabbatical Scholar" → "The Immersion Seeker"
- Line 238: "The Healing Journeyer" → "The Restoration Seeker"
- Line 246: "The Retirement Ranger" → "The Boundless Explorer"

**9. `docs/NEON_TO_CLOUD_MIGRATION.md`**
- Line ~75: "The Digital Explorer" → "The Untethered Traveler"

**10. `supabase/functions/calculate-travel-dna/index.ts`**
- Line ~817: comment "Retreat Regular" → "Wellness Devotee"
- Line ~824: comment "Status Seeker" → "VIP Voyager"

### Not Changed
- `src/components/home/MicroQuizComparison.tsx`: Already uses "Milestone Voyager" — no change needed.
- `src/components/home/SampleArchetype.tsx`: Already uses "Milestone Voyager" — no change needed.
- All slug/ID values (e.g., `digital_explorer`, `retreat_regular`) remain unchanged.

