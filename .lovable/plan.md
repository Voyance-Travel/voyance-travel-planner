

## Fix: Guarantee Must-Do Fulfillment for All User-Mentioned Items

### The Problem (Three Failures, Three Root Causes)

**1. "Champagne at the Eiffel Tower" / "Wine in Sicily"** — These are **experience requests**, not venue names. `parseMustDoInput` classifies them as `priority: 'high'` (line 378), not `'must'`. Both the per-day retry (line 2884-2904) and the Stage 2.8 injection (line 6425) only enforce items with `priority === 'must'`. High-priority items are prompted but never validated or injected.

**2. "Taormina"** — This is a destination mention, not an activity. The chat planner has no instruction to promote nearby-but-not-overnight destinations into `mustDoActivities`. It gets silently dropped during extraction.

**3. Generic experience requests** — "Wine in Sicily" doesn't match any known landmark or event pattern, so it gets the default `high` priority. Even if it were `must`, the fuzzy matcher would struggle because the AI might title the activity "Wine Tasting in Etna Valley" and the user's text is "wine in Sicily" — no word overlap threshold met.

### The Fix (Four Changes)

**Change 1: Promote ALL must-do items to `must` priority** (`must-do-priorities.ts`)

The distinction between `must`, `high`, and `nice` made sense for a best-effort system. Now that we have enforcement, every item the user puts in `mustDoActivities` should be treated as `must` — they typed it, they want it. The only items that should be `nice` are ones parsed from `additionalNotes` or auto-detected context.

- In `parseItem()` (line 378): Change default priority from `'high'` to `'must'`
- Keep `nice` classification only for explicit "if possible" / "would like" language

This single change activates enforcement for ALL user-specified items across both Layer 1 (retry) and Layer 2 (injection).

**Change 2: Capture nearby destinations as must-do day trips** (`chat-trip-planner/index.ts`)

Add a "DAY TRIP / NEARBY DESTINATION CAPTURE" instruction to the system prompt (after the multi-city section, ~line 115):

> When the user mentions a town or destination that is NEAR one of their main cities but NOT a separate overnight stop, capture it in `mustDoActivities` as a day trip. Examples: "Taormina" near Catania → "Day trip to Taormina from Catania". RULE: If the user mentions ANY place name that you don't include in `cities[]`, it MUST appear in `mustDoActivities`.

This closes the extraction gap. Once in `mustDoActivities`, the enforcement pipeline handles it.

**Change 3: Broaden fuzzy matching for experience-type requests** (`must-do-priorities.ts`)

Current `fuzzyMatchMustDo` checks word overlap. "Wine in Sicily" → significant words: `["wine", "sicily"]`. If the AI titles it "Etna Wine Tasting Experience", only "wine" matches (1/2 = 50%, below 80% threshold).

Fix: Add a fourth matching strategy — **semantic keyword extraction**. Before word matching, extract "core concept words" (nouns/adjectives, not place names) from the must-do and check if ANY activity on ANY day contains them in combination with the destination context. Specifically:
- Strip destination/city names from both sides before matching
- If the must-do has ≤ 2 significant words after stripping, require only 1 word match (not 80%)
- Add case: if must-do is 1-2 words (e.g., "wine", "cooking class"), match if the word appears in ANY activity title + category combination

**Change 4: Enforce `high` priority items in Stage 2.8** (`generate-itinerary/index.ts`)

Currently `validateMustDosInItinerary` skips items where `priority !== 'must'` (line 984). After Change 1, most items will be `must`. But as a belt-and-suspenders measure:
- In the validation function (line 984), also include `high` priority items
- In Stage 2.8 injection, inject `high` items too (they represent user intent)

Additionally, surface injected must-dos as a note in the day's editorial content rather than just a bare placeholder — per user preference for "mention in notes" behavior when scheduling is impossible.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-itinerary/must-do-priorities.ts` (line 378) | Change default priority from `'high'` to `'must'` for all parsed items |
| 2 | `supabase/functions/generate-itinerary/must-do-priorities.ts` (line 949-969) | Add short-text matching strategy and destination-stripping to `fuzzyMatchMustDo` |
| 3 | `supabase/functions/generate-itinerary/must-do-priorities.ts` (line 984) | Include `high` priority items in validation, not just `must` |
| 4 | `supabase/functions/chat-trip-planner/index.ts` (~line 115) | Add day trip / nearby destination capture instruction to system prompt |
| 5 | `supabase/functions/generate-itinerary/index.ts` (Stage 2.8, line 6449-6461) | Enrich injected placeholders with editorial note: "You mentioned [X] — we've added it to your day. Tap to customize details." |

### What This Guarantees

After these changes:
- "Champagne at the Eiffel Tower" → parsed as `must` → retry enforcement → injection if missed
- "Wine in Sicily" → parsed as `must` → fuzzy match catches "Wine Tasting" activities → injection if missed
- "Taormina" → captured as "Day trip to Taormina from Catania" in `mustDoActivities` → full enforcement pipeline
- Every item the user types gets the same enforcement as meals and activity density

