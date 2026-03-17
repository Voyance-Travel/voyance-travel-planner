

## Fix: Wine Experiences Not Prominently Featured Despite Explicit Request

### Root Cause (Three Gaps)

**1. Chat planner drops "wine" as an interest category.** The valid `interestCategories` list (line 158 of `chat-trip-planner/index.ts`) is: `history, food, nightlife, art, nature, shopping, adventure, culture, relaxation, architecture, music, sports, photography, family, romance`. **"Wine" is not a valid value.** When a user says "we love wine," the AI maps it to "food" — losing the wine specificity entirely.

**2. Interest override prompt has no "wine" key.** The `interestActivityMap` (line 5639 of `generate-itinerary/index.ts`) maps interests like "food", "adventure", "nightlife" to specific activity density instructions. There is no `wine` entry. Even if wine made it through as an interest, it would generate no override instruction telling the AI to schedule vineyard/tasting experiences.

**3. Forced slot cadence is too sparse.** The `interestSlotMap` in `personalization-enforcer.ts` (line 729) has a wine entry with cadence 3 (every 3rd day). For a 2-3 day city segment like Sicily, the cadence math (`dayNumber % 3 === 0`) means wine might only trigger on day 3 — missing days 1-2. And this only fires if "wine" is in the interests array, which gap #1 prevents.

**Net result:** "Wine" → extracted as "food" → no wine-specific override → no forced wine slots → AI generates generic food experiences instead of vineyard visits.

### The Fix (Three Changes)

**Change 1: Add "wine" to valid interest categories** (`chat-trip-planner/index.ts`)

Add `wine` to the valid values list on line 158. Add an extraction example: `"we love wine" → interestCategories: ["wine"]`. This ensures the AI extracts it as a distinct interest rather than folding it into "food."

**Change 2: Add wine to interest override prompt** (`generate-itinerary/index.ts`)

Add entries to `interestActivityMap` (line 5639):
```
'wine': 'At least 1 wine experience per city (vineyard tour, wine tasting, wine bar, sommelier-led experience). In wine regions (Tuscany, Sicily/Etna, Bordeaux, Napa, etc.) this should be a HIGHLIGHT activity, not a footnote.'
'wine & spirits': 'At least 1 wine/spirits experience per city (vineyard, distillery, tasting room, cocktail masterclass)'
```

This creates an explicit AI instruction to schedule wine activities.

**Change 3: Reduce wine forced slot cadence** (`personalization-enforcer.ts`)

Change wine cadence from `3` to `2` (line 729). This ensures wine experiences appear on days 1, 2, 4, 6... covering short city segments. For a 3-day Sicily stay, this guarantees at least 2 wine-focused slots.

### Files to Change

| # | File | Line | Change |
|---|------|------|--------|
| 1 | `supabase/functions/chat-trip-planner/index.ts` | 155-158 | Add "wine" example and to valid values list |
| 2 | `supabase/functions/generate-itinerary/index.ts` | 5639-5655 | Add `wine` and `wine & spirits` keys to `interestActivityMap` |
| 3 | `supabase/functions/generate-itinerary/personalization-enforcer.ts` | 729 | Change wine cadence from `3` to `2` |

