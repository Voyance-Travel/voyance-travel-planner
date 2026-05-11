## Why Madrid Day 2 still leaked despite the M1 fix

The `scrubPhantomEventRefs` infrastructure already exists (`supabase/functions/_shared/prompt-leak-scrub.ts`, wired into `repair-day.ts §10b` + `action-save-itinerary.ts`). I read the implementation end-to-end. Two structural gaps explain why "Freshen up at Mandarin Oriental Ritz; leave by 20:30 for tonight's Michelin-starred dinner" survived:

**Gap A — Single-sentence guard returns null.**
`scrubPhantomEventRefsFromString` (line 393–405) splits on `(?<=[.!?])\s+` and explicitly bails out for `parts.length < 2`:
```ts
if (parts.length < 2) {
  // Single sentence: only flag — never blank the field.
  return null;
}
```
The Madrid copy is a **single sentence joined by `;`** (or no terminator at all on the freshen-up line). Splitter sees one part → returns null → nothing stripped. Same for em-dash / en-dash joined clauses ("Freshen up — then leave by 20:30 for tonight's dinner").

**Gap B — No prompt-side prevention.**
The per-activity description prompt in `prompt-library.ts` does not inject the day's actual schedule, so the LLM has no signal that the Michelin dinner was dropped. Scrubbing is the only defense, and Gap A makes it leaky.

The user-requested validator (`DESCRIPTION_GHOST_REFERENCE`) also has no representation in `applyValidationGate`, so we have no telemetry attribution when this fires.

## Plan

### 1. Prompt-side prevention (Gap B)

**File:** `supabase/functions/generate-itinerary/prompt-library.ts`

Add a new section to the day-generation system prompt (and to whichever per-activity description prompt exists in this file) injecting the live day schedule with a HARD RULE:

```
HARD RULE — SCHEDULE COHERENCE
Only reference activities that ALSO appear in this day's schedule below. Do NOT
write "tonight's dinner / after the museum / leave by 20:30 for X / following
your tour" unless that exact event is scheduled. If the schedule has no
dinner, you MUST NOT write "tonight's dinner" anywhere.

Day schedule (ground truth):
- 09:00 Breakfast at La Mallorquina
- 11:00 Prado Museum
- 18:30 Freshen up at Mandarin Oriental Ritz
(no dinner scheduled)
```

Built from `buildDayScheduleSummary` + an inline `act.startTime + ' ' + act.title` list — same shape the scrubber already uses. Skip locked/extracted/manual rows so the LLM sees the canonical schedule it's expected to honor.

### 2. Clause-level scrub (Gap A)

**File:** `supabase/functions/_shared/prompt-leak-scrub.ts` — `scrubPhantomEventRefsFromString`

- **Split on clause separators** in addition to sentence terminators: `;`, ` — `, ` – ` (em/en dash with surrounding spaces). Track which separator each part used so the rebuilt copy preserves separator style.
- **Single-segment phantom refs:** if the entire field is one segment AND it contains a phantom ref AND the segment is essentially *only* the phantom ref (≤ 14 words after stripping the ref leaves <3 meaningful tokens), drop the field entirely (return empty string sentinel) and let the dining-description-backfill / UI fallback handle the empty state. Otherwise return the original (current behavior — never blank rich copy).
- **Multi-clause partial strip:** when only some clauses are phantom, drop them and rejoin with `. ` for sentence boundaries or `; ` for clause boundaries to keep readable English.

This preserves the existing safety net ("never destroy single rich sentence") while plugging the dominant Madrid leak shape.

### 3. Validation-gate code + telemetry (user request #2)

**File:** `supabase/functions/generate-itinerary/pipeline/validate-day.ts` (or wherever `applyValidationGate` lives)

- Register new code `DESCRIPTION_GHOST_REFERENCE` with severity `warning`.
- Detector: run `buildDayScheduleSummary` once per day, then for each non-locked activity test all body fields with the existing `PHANTOM_REF_PATTERNS`; emit one violation per offending activity carrying `{ activityId, referencedEvent, field }`.
- Resolution: when fired, run `scrubActivity({ daySchedule })` once; if the scrub couldn't reduce the field (Gap A residual), force-blank that field with a `[VALIDATION_GATE] code=DESCRIPTION_GHOST_REFERENCE action=blanked` log.
- Sentinel: `[VALIDATION_GATE] DESCRIPTION_GHOST_REFERENCE day=N count=K resolved=K` so we can confirm the M1 fix in production logs.

### 4. Tests

**New file:** `supabase/functions/_shared/__tests__/phantom-ref-clause-scrub.test.ts`

- Madrid Day 2 reproducer: `"Freshen up at Mandarin Oriental Ritz; leave by 20:30 for tonight's Michelin-starred dinner."` with `hasDinner=false` → second clause dropped, first clause survives.
- Em-dash variant: `"Take a moment to refresh — then leave by 20:30 for tonight's Michelin dinner"` → second clause dropped.
- Single-segment phantom: `"Leave by 20:30 for tonight's Michelin dinner"` (no other content) → field blanked.
- Negative: `"Take a moment to refresh"` (no phantom) → unchanged.
- Negative: `"Tonight's dinner at Coque awaits"` with `hasDinner=true` → unchanged (resolves OK).

**Add to** existing `prompt-leak-scrub.test.ts`: assert `buildDayScheduleSummary` is called by `applyValidationGate` and emits `DESCRIPTION_GHOST_REFERENCE` for the residual case.

### 5. Memory update

Extend `mem://constraints/itinerary/schedule-coherent-copy` with:
> M2: Clause-level split (`;` / em-dash) + single-segment phantom-ref blanking added to `scrubPhantomEventRefsFromString`. Day-schedule "ground truth" block injected into per-activity description prompt. New validation-gate code `DESCRIPTION_GHOST_REFERENCE` ensures any residual leak is force-blanked + logged. Closes Madrid Day 2 "Freshen up … leave by 20:30 for tonight's Michelin-starred dinner" with no dinner card.

## Out of scope

- No re-prompting / second LLM call for stripped descriptions — the cost/latency trade-off doesn't justify it; UI gracefully handles empty descriptions via the existing dining-description-backfill + whyThisFits chain.
- No change to `scrubActivity` signature — `daySchedule` already flows through `ScrubContext`.
- No change to `repair-day.ts §10b` wiring — the upgraded scrubber is automatically picked up.

## Verification

1. Unit: `bunx vitest run supabase/functions/_shared/__tests__/phantom-ref-clause-scrub.test.ts`.
2. Manual: regenerate the Madrid 3-day trip; confirm no description on Day 2 references "tonight's dinner" when the dinner card is absent.
3. Logs: grep server output for `[SCRUB_PHANTOM_REF]` and `[VALIDATION_GATE] DESCRIPTION_GHOST_REFERENCE` to confirm both layers fire (scrub for typical cases, gate for residuals).