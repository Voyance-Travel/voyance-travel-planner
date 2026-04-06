

## Eliminate Placeholder Meals — Complete Fix

### Root Cause Analysis

The validate → repair pipeline for placeholder meals exists and is well-structured, but has **two critical gaps**:

1. **`destination` not passed to `validateDay`**: Both callers (`action-generate-trip-day.ts` line 843 and `action-generate-day.ts` line 825) omit the `destination` field. This means `checkGenericVenues` can never detect city-name-as-venue (e.g., venue="Paris") because `destLower` is always empty.

2. **Prompt restaurant hints are Lisbon-only**: Line 851 of `compile-prompt.ts` only lists Lisbon restaurants. Paris, Berlin, Rome, London trips get no examples, making the AI more likely to fall back to placeholders.

3. **Fallback list is thin**: Paris has only 4 breakfast, 4 lunch, 4 dinner fallbacks. A 5-day trip needs 5 breakfasts and 5 lunches — if the pool is exhausted and 1+ slot hits the fallback, it runs out.

### Changes

#### 1. Pass `destination` to `validateDay` in both callers

**`action-generate-trip-day.ts` (~line 843)**: Add `destination: cityInfo?.cityName || destination,` to the `validateDay` call.

**`action-generate-day.ts` (~line 825)**: Add `destination: destination || resolvedDestination,` to the `validationInput` object (need to check which variable holds the city name in that file).

This is the most important fix — it unlocks the city-name-as-venue detection that's already coded.

#### 2. Expand prompt restaurant hints per city (`compile-prompt.ts` ~line 851)

Replace the Lisbon-only line with city-aware hints. For the destination city, inject 8-10 real restaurant names per meal type (breakfast, lunch, dinner). Use the restaurants already in `FALLBACK_RESTAURANTS` plus extras from the user's prompt. This gives the AI concrete options instead of falling back to "at a bistro."

Format:
```
For ${city}, use REAL restaurants like:
- BREAKFAST: Café de Flore, Angelina, Stohrer, Du Pain et des Idées, Claus, Ladurée, Carette, Holybelly
- LUNCH: Le Comptoir du Relais, Bouillon Chartier, Chez Janou, Les Philosophes, Pink Mamma
- DINNER: Sacré Fleur, Le Train Bleu, Brasserie Lipp, Le Relais de l'Entrecôte, Drouant
```

#### 3. Expand Paris fallback restaurants in `repair-day.ts`

Add 4-6 more entries per meal type for Paris (and a few extras for other cities) to ensure a 5-day trip can't exhaust the fallback pool. Currently Paris has 4 per meal type; expand to 8-10 per type.

Additional Paris restaurants to add:
- Breakfast: Angelina, Stohrer, Ladurée, Holybelly, Boot Café, Ob-La-Di
- Lunch: Les Philosophes, Pink Mamma, Robert et Louise, Bofinger
- Dinner: Le Train Bleu, Brasserie Lipp, Le Relais de l'Entrecôte, Drouant, Le Voltaire, Chez Georges

#### 4. Strengthen prompt anti-placeholder language (`compile-prompt.ts`)

Add explicit "NEVER generate" examples at the top of the dining rules, including the exact patterns seen in the regression:
- "Breakfast at a neighborhood café"
- "Lunch at a bistro"  
- "Dinner at a brasserie"
- "Breakfast at a boulangerie-café"
- Any venue named "the destination" or just the city name

### Files to edit

| File | Change |
|------|--------|
| `action-generate-trip-day.ts` | Add `destination` to `validateDay` call (~line 843) |
| `action-generate-day.ts` | Add `destination` to `validationInput` object (~line 825) |
| `pipeline/compile-prompt.ts` | Expand restaurant hints per city; strengthen anti-placeholder language |
| `pipeline/repair-day.ts` | Expand Paris fallback restaurants from 4→8-10 per meal type |

