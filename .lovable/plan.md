## Goal

Remove em dashes (`—`) from user-visible UI copy across the app. They currently appear in headings, body copy, toasts, empty states, tooltips, badges, and onboarding flows. Each occurrence gets the cleanest replacement for its sentence — typically a hyphen with spaces, a colon, or a comma — without changing meaning.

## Scope

**In scope** — frontend UI text only:
- JSX/TSX text nodes (children of elements)
- String literals passed to `toast.*`, `aria-label`, `title`, `placeholder`, `description`, `label` props
- Empty-state, error, and loading copy in components
- Constants files that feed UI (e.g. archetype copy, onboarding scripts) when they are clearly display strings

**Out of scope** (will leave em dashes intact):
- Code comments and JSDoc
- `console.log` / `console.warn` / `console.error`
- AI prompts, edge functions, and backend (`supabase/functions/**`)
- Tests (`*.test.ts`, `*.test.tsx`)
- Sentinel log strings and telemetry tags
- Regexes that intentionally match `—` (e.g. phantom-ref scrub, prompt-leak scrub) — these must stay as-is to keep existing sanitizers working
- `.md` files

## Replacement rules (mixed, per context)

1. **Subordinate clause / aside** → `, ` (comma) — e.g. `"Finding restaurant — please wait"` → `"Finding restaurant, please wait"`
2. **Label : value** → `: ` (colon) — e.g. `"Trip total — $1,200"` → `"Trip total: $1,200"`
3. **Range / separator / parenthetical phrase** → ` - ` (hyphen with spaces) — e.g. `"Day 1 — Arrival"` → `"Day 1 - Arrival"`
4. **Strong break / emphasis** → split into two sentences when natural — e.g. `"All set — your trip is ready."` → `"All set. Your trip is ready."`
5. **Within a URL, code snippet, or regex literal** → leave untouched

## Approach

1. **Inventory pass**: list every `—` occurrence in `src/**/*.{ts,tsx}` excluding tests, scrubbers, and prompt-related modules. Tag each with file + line + surrounding context.
2. **Classify each occurrence**: UI string vs. comment/log/regex/prompt. Skip non-UI.
3. **Apply replacements** in batches grouped by file, picking rule 1–5 per occurrence.
4. **Preserve guarded files**: explicitly skip `src/utils/textSanitizer.ts` regex constants, `phantom-ref` scrub paths, and any file matching `*scrub*`, `*sanitiz*`, `*prompt*` unless the occurrence is in a JSX text node.
5. **Verify**: re-run the grep to confirm only intentional `—` remain (regex constants, comments, test fixtures). Spot-check the preview on a trip detail page, the home page, and the start flow.

## Risk notes

- Several files (`textSanitizer.ts`, phantom-ref guards) intentionally split copy on `—`. Those regexes must remain — only JSX text changes there.
- Some constants in `src/data/**` may feed both AI prompts and UI. Where ambiguous, I'll prefer the colon/hyphen replacement (still grammatical for prompts) so prompts don't break.
- No backend or DB changes. No behavior changes. No new dependencies.

## Deliverable

A single batch of edits across the ~165 TSX files (plus a handful of TS UI-string files), followed by a verification grep showing remaining `—` are only in allowlisted contexts (regexes, comments, prompts, tests).
