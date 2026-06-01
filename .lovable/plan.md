# Find Alternative → "Similar" Returns Zero — Diagnosis Correction

## The proposed fix doesn't match the code

The user's hypothesis points at `fix-placeholders.ts` and a `swapFilter === 'similar'` DB category filter. **That code path does not exist.** I traced the actual flow:

```text
ActivityAlternativesDrawer.tsx
  └─ POST get-activity-alternatives  { suggestionMode: 'similar' }
        └─ getAIAlternatives() → Lovable AI Gateway (gemini-2.5-flash-lite)
              └─ tool_call "suggest_activities" → { activities: [...] }
                    └─ filter: drop AI-stub *dining* venue names only
                    └─ return alternatives[]
        └─ fallback: generateTemplateAlternatives() (always non-empty)
```

There is **no `swapFilter`**, no `destinations`/cached-activity table lookup, and no category-match query anywhere in the Similar path. `fix-placeholders.ts` is part of the generation pipeline (placeholder venue swaps), not the Find-Alternative drawer.

So a category-normalization patch on a query that doesn't exist would change nothing for Edinburgh Castle.

## Actual likely causes of "0 results" for Similar

Ranked by probability, given the real code:

1. **AI response shape miss** — `data.choices[0].message.tool_calls[0]` is missing/empty (gateway returned plain text instead of tool call). `getAIAlternatives` throws `'No tool call response from AI'`, catch falls through to `generateTemplateAlternatives` — which **does** always return entries. So this alone wouldn't give zero.
2. **Stale request guard** in the drawer (`fgRequestIdRef.current !== requestId` at lines 219/230/234). If the drawer remounts or the activity prop changes mid-flight, results are discarded silently and `similarAlternatives` stays `[]`. No toast fires.
3. **Edge function 500** — outer catch returns `{ success: false, alternatives: [] }` with status 500. `invokeWithTimeout` likely resolves with that body; UI reads `data.alternatives` (empty) and shows nothing without a toast.
4. **Foreground timeout** — `invokeWithTimeout` resolves `null`; initial path silently no-ops (only the *quick-filter* path shows the "Taking longer than usual" toast).
5. **Dining-stub filter over-firing** — only relevant for dining categories. Edinburgh Castle is cultural, so this is **not** it.

## What I want to do instead

A small, evidence-first patch focused on the real path, not the imagined one:

1. **Instrument the real edge fn** — add structured logging at the three failure exits in `get-activity-alternatives/index.ts` so we can tell which branch produces empty:
   - `[alt] empty: ai_no_tool_call`
   - `[alt] empty: ai_filtered_to_zero`
   - `[alt] empty: outer_catch`
   Then ask the user to reproduce on Edinburgh Castle and re-check logs.
2. **Close the silent-fail UX gap** in `ActivityAlternativesDrawer.tsx`:
   - On `fetchInitialAlternatives`, if `data?.alternatives?.length === 0`, fall through to a second attempt with `suggestionMode: 'different'` OR surface a toast ("Couldn't find similar options — try Different or search"). Today it silently shows an empty list.
3. **Harden the AI fallback path** — make `generateTemplateAlternatives` actually run when AI returns 0 results (not only when it throws). Currently `alternatives = await aiPromise` of length 0 is treated as success and short-circuits the template fallback.

That's the real fix. No `fix-placeholders.ts` edits, no category-group mapping, no DB-query change — because none of those are in this path.

## Open question before I build

Do you want me to:

- **(A)** Ship the instrumentation + UX fallback + template-fallback hardening above (recommended — addresses the real bug shape).
- **(B)** Just the template-fallback hardening (smallest possible change; guarantees Similar is never empty but hides the underlying cause).
- **(C)** You believe `fix-placeholders.ts` is genuinely involved via some path I missed — point me at the call chain (which UI button → which service call → which edge fn) and I'll re-investigate before planning.

I'd lean (A). Confirm before I switch to build.
