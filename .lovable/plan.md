

## Kill Hallucinated Restaurants

### Root Cause

"Trattoria del Corso" and "Café Lumière" aren't AI hallucinations — they're **hardcoded fallback templates** in `fix-placeholders.ts` (lines 269-297). The `GENERIC_VENUE_TEMPLATES` pool is used when the nuclear sweep can't find a real replacement. These fake names get injected with no real address, then survive all downstream guards.

### Fix (3 changes, 2 files)

#### 1. Remove fake names from GENERIC_VENUE_TEMPLATES (fix-placeholders.ts)
Replace the entire template pool with names that are obviously generic/descriptive rather than plausible-sounding fake restaurant names. Use format like "Local Breakfast Café", "Neighborhood Lunch Spot", "Evening Restaurant" — names that clearly signal "placeholder" so the AI or user knows to replace them, OR better yet, remove the template pool entirely and have the nuclear sweep use a structured format like `"[Meal] at a Local [Cuisine] Restaurant"` which is already handled by downstream placeholder detection.

#### 2. Add hallucination filter after AI parse in action-generate-trip-day.ts (~line 748)
Insert the user's filter code right after `dayResult` is set and before sanitization (line 746). This catches AI-generated fakes before any other processing:
- Block known fake names (trattoria del corso, café lumière, etc.)
- Block dining with missing/fake addresses (< 10 chars, "the destination", bare city names)

#### 3. Add same filter in action-generate-day.ts (~line 287)
Insert after `normalizedActivities` is created from `generatedDay.activities.map(...)`, before the quality pass.

### Files Changed
1. `supabase/functions/generate-itinerary/fix-placeholders.ts` — remove fake restaurant names from GENERIC_VENUE_TEMPLATES, replace with clearly-labeled generic format
2. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — add inline hallucination filter after AI parse
3. `supabase/functions/generate-itinerary/action-generate-day.ts` — add same inline hallucination filter after normalization

