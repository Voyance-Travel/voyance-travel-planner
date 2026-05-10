
Single-file JSON edit to `src/config/quiz-questions-v3.json` — but with three corrections to the user's spec, because what they described won't actually surface in the quiz.

## Corrections to spec (must apply)

1. **Schema mismatch.** User's spec uses `{ question, answers[].text, scores }`. Actual v3 schema is `{ id, step, category, prompt, type, feedback, answers[].label, answers[].traits }`. The Quiz UI (`Quiz.tsx:75`) reads `q.prompt`, `q.step`, etc. — the user's keys would render blank. I will conform to the existing schema.

2. **Two new traits don't exist in `traitDefinitions`.** The spec references `experience_seeking` (q22c) and `solo_preference` (q23a). Neither is in the registry. The matcher (`archetype-matcher.ts:89`) only seeds traits that are in `traitDefinitions`, so unknown traits will be silently dropped. Resolution: register both new traits alongside the 5 added in the previous turn.

3. **The Quiz UI does NOT iterate the JSON array.** `Quiz.tsx:96` reads `quizConfig.stepCategories[step]` and shows only questions whose IDs appear in `stepCategories[*].questions`. **Adding to `questions` alone makes them invisible.** New questions must also be registered under `stepCategories`. Without this, the verify-by-taking-the-quiz step will fail.

## Edits

### 1. Add 2 entries to `traitDefinitions` (around line 1304)

```json
"experience_seeking": { "dimension": "motivation", "range": [0, 1], "default": 0.4, "description": "Drive to collect memorable stories and standout moments" },
"solo_preference":    { "dimension": "social",     "range": [0, 1], "default": 0.3, "description": "Prefers traveling alone over any companion configuration" }
```

### 2. Append two questions to `questions` array (after current `q21_values`, before the `]` at line 1278)

Conformed to file's schema:

```json
{
  "id": "q22_accomplishment",
  "step": 10,
  "category": "Purpose",
  "prompt": "When you've been somewhere, what feels most like accomplishment?",
  "type": "single",
  "feedback": {
    "q22a": "The trusted source friends ask.",
    "q22b": "Collector's instinct.",
    "q22c": "Story-first traveler.",
    "q22d": "Present-moment traveler."
  },
  "answers": [
    { "id": "q22a", "label": "Knowing it well enough that friends ask me for advice on their trips",
      "traits": { "experience_accumulation": 0.9, "social_sharing": 0.85, "cultural_depth": 0.4 } },
    { "id": "q22b", "label": "Adding it to my country count or passport stamp collection",
      "traits": { "collection_drive": 0.9, "bucket_list": 0.6, "novelty_seeking": 0.5 } },
    { "id": "q22c", "label": "Having a story I'll be telling for years",
      "traits": { "experience_seeking": 0.8, "novelty_seeking": 0.6, "social_sharing": 0.4 } },
    { "id": "q22d", "label": "Just being there in the moment — no need to mark it",
      "traits": { "restoration_need": 0.5, "spirituality": 0.4, "pace": 0.2 } }
  ]
},
{
  "id": "q23_recharge",
  "step": 10,
  "category": "Restoration",
  "prompt": "When you need to recharge from your normal life, what kind of trip works?",
  "type": "single",
  "feedback": {
    "q23a": "Untraceable solo escape.",
    "q23b": "Sanctuary mode.",
    "q23c": "Slow wander.",
    "q23d": "Beach reset."
  },
  "answers": [
    { "id": "q23a", "label": "I disappear solo — friends don't always know where I am",
      "traits": { "autonomy_preference": 0.9, "escape_need": 0.7, "solo_preference": 0.85 } },
    { "id": "q23b", "label": "I retreat to one place, mostly stay there, get spa/yoga/healthy food",
      "traits": { "escape_need": 0.85, "restoration_need": 0.8, "healing_focus": 0.6, "spirituality": 0.4 } },
    { "id": "q23c", "label": "I move at my own slow pace through somewhere new",
      "traits": { "pace": 0.2, "restoration_need": 0.5, "flexibility": 0.6 } },
    { "id": "q23d", "label": "I need a beach. Just water, sand, and stillness.",
      "traits": { "nature_orientation": 0.5, "restoration_need": 0.7, "pace": 0.3 } }
  ]
}
```

Both pinned to `step: 10` (the existing final "You" step) so they slot in at the end of the existing flow without renumbering.

### 3. Register them in `stepCategories` (line 1890) — REQUIRED for UI visibility

Update the step-10 entry:

```json
{ "step": 10, "label": "You", "questions": ["q19_lifestage", "q20_quality", "q21_values", "q22_accomplishment", "q23_recharge"] }
```

(Optionally retitle step 10 label to keep it short — leaving as `"You"` is fine.)

### 4. Bump metadata count

```text
"totalQuestions": 21  →  23
```

## Verification

```bash
node -e "JSON.parse(require('fs').readFileSync('src/config/quiz-questions-v3.json','utf8'));console.log('OK')"
grep -c '"id": "q22_accomplishment"' src/config/quiz-questions-v3.json   # 1
grep -c '"id": "q23_recharge"'       src/config/quiz-questions-v3.json   # 1
grep -c '"id": "q22'                 src/config/quiz-questions-v3.json   # 5 (1 question + 4 answers)
grep -c '"id": "q23'                 src/config/quiz-questions-v3.json   # 5
grep -c 'experience_seeking'         src/config/quiz-questions-v3.json   # 2 (registry + q22c)
grep -c 'solo_preference'            src/config/quiz-questions-v3.json   # 2 (registry + q23a)
grep -c 'q22_accomplishment'         src/config/quiz-questions-v3.json   # 2 (questions array + stepCategories)
grep -c 'q23_recharge'               src/config/quiz-questions-v3.json   # 2
```

End-to-end UX check is owned by the user (manual quiz run); I'll confirm via `bun run build` that nothing import-side breaks.

## Out of scope (flagging only)

- No archetype `boosters`/`required`/`penalties` reference `experience_seeking` or `solo_preference` yet. They're carried in `trait_scores` for downstream use but won't shift archetype matching until wired in (same v1.1 follow-up flagged in the previous turn).
- Step 10 "You" will now contain 5 questions; if you'd rather split into `step: 11`, that requires also extending `stepCategories` with a new step entry and updating any progress-bar UX expectations. Not doing that by default — additive-only is safer.
