
Single-file JSON edit to `src/config/quiz-questions-v3.json`. No code changes, no schema refactor, no migration.

## 1. Add 5 entries to `traitDefinitions` (around line 1299)

Conform to the existing schema (`{ dimension, range, default, description }`) — the file's matcher only reads `default`, but matching the existing style keeps the registry consistent. The user's `label` field is dropped because no consumer reads it.

Insert before the closing `}` of `traitDefinitions`:

```json
"experience_accumulation": { "dimension": "motivation", "range": [0, 1], "default": 0.5, "description": "Drive to visit many places and become a recommendation authority" },
"social_sharing":          { "dimension": "social",     "range": [0, 1], "default": 0.4, "description": "Tendency to share travel knowledge and give recommendations to others" },
"collection_drive":        { "dimension": "motivation", "range": [0, 1], "default": 0.3, "description": "Tracks destinations/countries as a collection metric" },
"escape_need":             { "dimension": "motivation", "range": [0, 1], "default": 0.4, "description": "Travels specifically to escape normal life (distinct from general restoration)" },
"autonomy_preference":     { "dimension": "social",     "range": [0, 1], "default": 0.4, "description": "Prefers solo, autonomous travel; resists group obligations" }
```

Add the trailing comma after the existing `ethics_focus` line so JSON parses.

## 2. Reweight existing answers

Add the listed boosters to each `traits` object. All values are merge-only — no existing trait values are altered.

| Q-ID | Answer label (existing) | Add |
|---|---|---|
| q4a | "Find a café and people-watch for an hour" | `healing_focus: 0.5` |
| q4d | "Head back to the hotel for a proper nap" | `healing_focus: 0.6` |
| q14a | "A conversation with a local that shifts your perspective" | `ethics_focus: 0.5`, `experience_accumulation: 0.4` |
| q12b | "Translation app open and ready" | `experience_accumulation: 0.6` |
| q12d | "I have a guide with me" | `experience_accumulation: 0.7` |
| q15d | "Best friends started as fellow travelers" | `social_sharing: 0.8` |
| q17a | "Alone, solo by choice" | `autonomy_preference: 0.9` |
| q6d | "Resists obligations to group" | `autonomy_preference: 0.85` |
| q6e | "Prefers small/no group" | `autonomy_preference: 0.7` |
| q5a | "Book famous restaurant ahead" | `collection_drive: 0.5` |
| q2d | "Bucket-list destination" | `collection_drive: 0.4` (stacks with existing `bucket_list` boost) |
| q16d | "Remote/quiet place" | `escape_need: 0.7` |
| q16e | "Very remote" | `escape_need: 0.85` |
| q21a | (no change — already `ethics_focus: 0.9`) | — |

Each modification is a localized JSON object insertion; existing trait keys/values stay untouched.

## 3. Add new answer `q21e`

Append a 5th option to `q21_values.answers`:

```json
{
  "id": "q21e",
  "label": "I prefer locally-owned, ethical operators",
  "traits": {
    "ethics_focus": 0.5,
    "social_sharing": 0.3
  }
}
```

Also add a feedback entry for `q21e` in the question's `feedback` block (matching the style of the existing four — short copy like `"Conscious local-first traveler."`).

## 4. Bump metadata

```text
"traitDimensions": 25  →  30
```

## Verification

After save:

```bash
grep -c '"experience_accumulation"' src/config/quiz-questions-v3.json   # expect 4 (registry + q14a + q12b + q12d)
grep -c '"social_sharing"'          src/config/quiz-questions-v3.json   # expect 3 (registry + q15d + q21e)
grep -c '"collection_drive"'        src/config/quiz-questions-v3.json   # expect 3 (registry + q5a + q2d)
grep -c '"escape_need"'             src/config/quiz-questions-v3.json   # expect 3 (registry + q16d + q16e)
grep -c '"autonomy_preference"'     src/config/quiz-questions-v3.json   # expect 4 (registry + q17a + q6d + q6e)
```

All ≥ user's stated thresholds. Plus:

- `node -e "JSON.parse(require('fs').readFileSync('src/config/quiz-questions-v3.json','utf8'))"` parses clean.
- `grep -c '"id": "q21' src/config/quiz-questions-v3.json` returns 6 (q21_values + q21a–q21e).

## Out of scope (call out, do not implement)

1. **No archetype `boosters`/`required`/`penalties` reference these new traits.** They'll be carried in `trait_scores` and visible to downstream consumers (DNA blob, profile-loader), but won't yet shift archetype matching results. Hooking them into specific archetype profiles (e.g. `social_sharing` boosting `community_builder`, `autonomy_preference` boosting `digital_explorer`) is a separate v1.1 task.
2. **`src/services/engines/travelDNA/trait-calculator.ts` still imports v2.** It is not on the live quiz scoring path (Quiz.tsx → archetype-matcher.ts uses v3 directly), so this change works as the user intends. The v2 calculator is legacy — flagging only.
