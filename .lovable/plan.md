## NEW.4 — Body-field slot-placeholder + requirement-prose scrub in `prompt-leak-scrub.ts`

### What's already covered (and where)

Slot tokens like `(FLEX_WINDOW)`, `(AESTHETIC slot)`, `(INTEREST_SLOT)` already get stripped in **titles/names** by:

- `supabase/functions/_shared/persist-day-contract.ts` (`PROMPT_ARTIFACT_RE`, drop-row gate)
- `supabase/functions/_shared/persist-itinerary.ts` (`stripPromptArtifactsInTitles`)
- `supabase/functions/generate-itinerary/sanitization.ts:1236–1239`
- UI: `src/utils/activityNameSanitizer.ts::stripPromptArtifacts` (titles) + `PROMPT_ARTIFACT_REPLACE_RE` chained in `sanitizeActivityText` (body text)
- UI: `src/utils/itineraryParser.ts` + `src/utils/textSanitizer.ts`

What's **NOT** covered today: the shared `_shared/prompt-leak-scrub.ts` body-field scrub (`scrubBodyPromptLeaks`) — which is the canonical boundary called by **validate-day**, **repair-day §10b**, **action-save-itinerary `normalizeDays`** (via `scrubActivity`). If `(FLEX_WINDOW)` or `This satisfies your 'Deep Context' requirement.` leaks into a `description`/`tips`/`notes` string, none of the existing scrubs run there — only title-side scrubs and the UI text scrub catch it. That means the leak persists in the JSON until render time.

The user's request closes that gap.

### Decision: reuse the existing artifact regex shape, not the narrow allowlist

The user's spec proposes a new regex `\(\s*(?:FLEX_WINDOW|INTEREST_SLOT|AESTHETIC|TIME[\s_-]?SLOT|MEAL[\s_-]?SLOT|slot|placeholder|TBD)\b[^)]*\)`. That's narrower than the existing system's regex (`persist-day-contract::PROMPT_ARTIFACT_RE` and the UI mirror), which catches **any** `(LABEL slot)`, `(LABEL placeholder)`, AND any bare `(ALLCAPS_WITH_UNDERSCORE)` token. Using the same shape here keeps system-wide coverage uniform — a new label like `(NARRATIVE_MOOD)` is already handled by the broader pattern, but would slip past the narrow allowlist.

Per `mem://technical/itinerary/stateful-regex-strip-bug`, we keep **two regexes** (one non-global for `.test()`, one `/g` for `.replace()`) so stateful `lastIndex` doesn't cause intermittent no-ops in `hasBodyPromptLeak`.

### Changes

**1. `supabase/functions/_shared/prompt-leak-scrub.ts`** — additions only.

Add (alongside `RESERVATION_LABEL_LEAK_RE` / `ORPHAN_EMPTY_LABEL_RE`):

```ts
// Slot-name placeholders the LLM occasionally echoes verbatim into description /
// tips / notes instead of replacing them: "(FLEX_WINDOW)", "(INTEREST_SLOT)",
// "(slot)", "(AESTHETIC slot)", "(NARRATIVE_MOOD)", etc.
// Mirrors persist-day-contract::PROMPT_ARTIFACT_RE and the UI artifact regex
// for system-wide coverage. Two-regex pattern guards against stateful-regex bug.
export const SLOT_PLACEHOLDER_LEAK_TEST_RE =
  /\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|TBD)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/i;
export const SLOT_PLACEHOLDER_LEAK_RE =
  /\s*\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|TBD)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)\s*/gi;

// Requirement-prose leak: "This satisfies your 'Deep Context' requirement."
// Catches the model echoing back the prompt's requirement language as flavor text.
export const REQUIREMENT_PROSE_LEAK_RE =
  /\s*\bThis\s+(?:satisfies|fulfills|fulfils|meets)\s+(?:your|the)\s+['"“”][^'"“”]{1,60}['"“”]?\s+(?:requirement|criterion|criteria|need)s?\s*\.?\s*/gi;
```

Chain both into `scrubString` (line 55–60):

```ts
const after = s
  .replace(RESERVATION_LABEL_LEAK_RE, '')
  .replace(ORPHAN_EMPTY_LABEL_RE, '')
  .replace(SLOT_PLACEHOLDER_LEAK_RE, '')        // NEW
  .replace(REQUIREMENT_PROSE_LEAK_RE, '')       // NEW
  .replace(/\s{2,}/g, ' ')
  .replace(/\s+\./g, '.')
  .trim();
```

Extend `hasBodyPromptLeak` (line 90–103) and `hasTitleLeak` (line 225–242) detectors to also test `SLOT_PLACEHOLDER_LEAK_TEST_RE` and `REQUIREMENT_PROSE_LEAK_RE` — using the dedicated non-global TEST variant for the slot regex so `.lastIndex` state never causes a false negative.

This automatically propagates to:
- `validate-day.ts` → `hasBodyPromptLeak` / `hasTitleLeak` flag the leak
- `repair-day.ts` §10b → `scrubBodyPromptLeaks` / `scrubTitleLeaks` strip in place
- `action-save-itinerary.ts` `normalizeDays` (via `scrubActivity`) → final pre-persist sweep
- UI: `activityNameSanitizer.ts::sanitizeActivityName` already calls `stripPromptArtifacts` upstream of the leak chain, so titles stay covered without a new edit there

**2. `src/utils/activityNameSanitizer.ts`** — single addition for the requirement-prose pattern.

The slot-artifact pattern is **already** chained in `sanitizeActivityText` via `PROMPT_ARTIFACT_REPLACE_RE` (line 386), so no duplicate needed. Only `REQUIREMENT_PROSE_LEAK_RE` is new for the UI side. Add a local `REQUIREMENT_PROSE_LEAK_RE` constant near the other UI-mirror regexes (~line 343) and chain it into `sanitizeActivityText` next to the other prompt-leak strips.

**3. No changes** to `persist-day-contract.ts`, `persist-itinerary.ts`, `sanitization.ts`, `textSanitizer.ts`, `itineraryParser.ts` — those layers already handle slot tokens at their respective boundaries.

### Verification

```
grep -c "SLOT_PLACEHOLDER_LEAK_RE\|REQUIREMENT_PROSE_LEAK_RE" supabase/functions/_shared/prompt-leak-scrub.ts
```
Expect ≥ 5 (2 declarations + 1 chain in `scrubString` + 2 detector test calls).

```
grep -c "REQUIREMENT_PROSE_LEAK_RE" src/utils/activityNameSanitizer.ts
```
Expect ≥ 2 (declaration + `.replace` in `sanitizeActivityText`).

Smoke shapes that should be stripped from `description`/`tips`/`notes` after the change:
- `"Wander Castello (FLEX_WINDOW)"` → `"Wander Castello"`
- `"A relaxed evening (AESTHETIC slot) with locals"` → `"A relaxed evening with locals"`
- `"Sunset views. This satisfies your 'Deep Context' requirement."` → `"Sunset views."`

Shapes that must NOT be stripped (regression guards):
- `"(NYC)"`, `"(USA)"` — bare acronyms (no underscore + not "slot/placeholder/TBD")
- `"Note: closed Mondays."` — already protected by `ORPHAN_EMPTY_LABEL_RE` only matching empty/dot-only values

### Files touched

- `supabase/functions/_shared/prompt-leak-scrub.ts` — 2 new regex pairs, 2 chains in `scrubString`, 2 detector extensions
- `src/utils/activityNameSanitizer.ts` — 1 new local regex + 1 chain in `sanitizeActivityText`
