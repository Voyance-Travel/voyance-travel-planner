## M1 — Day continuity fix: strip phantom event references from copy

**Bug.** A "Freshen up" card on Day 2 said "leave by 20:30 for tonight's Michelin-starred dinner" — but no dinner card was scheduled. The description was generated independently of the day's actual activity list, so it referenced an event that doesn't exist.

**Fix philosophy.** Same pattern we already use for `Reservation Urgency:` and meal-suffix leaks: a small **prompt rule** + a **shared scrubber** wired into the existing validate / repair / save / UI boundaries. No new pipeline stage, no regen loop — phantom references are downgraded in place (sentence stripped) so we never ship copy that lies about the schedule.

---

### Step 1 — Prompt rule (compile-prompt.ts)

In `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`, add a rule alongside the existing "Never include parenthetical notes / operational notes" block (~line 1350–1354):

> **Schedule-coherent copy.** A description, tip, or note may only reference another activity that ALSO appears in this day's schedule. Phrases like "tonight's dinner", "after the museum", "before tomorrow's flight", "later this evening", or "leave by HH:MM for X" must point at a real card on the same day. If the referenced card is not present, omit the reference entirely — do not invent it.

Cheap, model already follows this class of rule; it's the cleanup pass below that actually closes the gap.

### Step 2 — New shared scrubber: `scrubPhantomEventRefs`

Add to `supabase/functions/_shared/prompt-leak-scrub.ts` (sits next to `scrubBodyPromptLeaks` / `scrubSentenceFragments`):

- Input: one activity + the **day's schedule** (titles, categories, start times).
- Build a small "what exists today" set:
  - boolean flags: `hasBreakfast / hasLunch / hasDinner / hasNightcap` (from category=`dining` + slot/time)
  - keyword set: tokenized titles (museum, gallery, tour, flight, train, checkout, spa, etc.)
- Scan each text field (`description`, `tips`, `notes`, `voyanceInsight`, `whyThisFits`) sentence-by-sentence. Drop a sentence iff it matches a **time-bound reference regex** AND the referent is missing:
  - `tonight'?s? (michelin[- ])?dinner` → require `hasDinner`
  - `this (afternoon|evening|morning)'?s? (\w+)` → require category/keyword match in same window
  - `(after|before|following) (the|your|tonight'?s?) (\w+)` → require keyword match in day
  - `leave by \d{1,2}:\d{2} (for|to) (the|your|tonight'?s?)? ?(\w+)` → require keyword match
  - `tomorrow'?s? (flight|train|checkout)` is **out of scope** (cross-day; handled elsewhere)
- Never blank the field — if removing the sentence empties it, leave the original (mirrors `scrubSentenceFragments` behavior).
- Returns `{ changed, ops: { phantomRefsStripped: N } }`.

Add unit tests in `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts` covering:
- "leave by 20:30 for tonight's Michelin-starred dinner" + no dinner → sentence dropped
- same sentence + dinner card present → preserved
- "after the Prado tour" + Prado card present → preserved
- "after the Prado tour" + no Prado → dropped
- single-sentence field that would be emptied → preserved

### Step 3 — Wire into the unified scrubber

Per **Unified Output Validation Layer** memory, all per-activity sanitization composes through `scrubActivity` (`supabase/functions/_shared/scrub-activity.ts`). Update its signature so callers can pass the day context:

```ts
scrubActivity(act, { destination, mealSlot, daySchedule? })
```

Inside `scrubActivity`, after the existing body/title/fragment scrubs, call `scrubPhantomEventRefs(act, daySchedule)` when `daySchedule` is provided. Bump the `ScrubOps` shape with `phantomRefsStripped`.

### Step 4 — Pass `daySchedule` at the 3 wired boundaries

`scrubActivity` is currently called from:

1. `repair-day.ts` §10b (line ~2829) — already iterates day; pass the sibling activity list.
2. `action-save-itinerary.ts` `normalizeDays` — pass each day's activities.
3. `src/lib/itinerary/activityNameSanitizer.ts` (UI) — pass the day's activities from the calling component (already in scope where this is invoked).

Also call directly inside `validate-day.ts` as a soft semantic check that emits a non-critical `phantom_event_reference` finding for telemetry, so we can monitor leak frequency without forcing regen.

### Step 5 — Logging & memory

- Sentinel: `[SCRUB_PHANTOM_REF] day=N stripped=K refs=[…]` (matches `[SCRUB_ACTIVITY]` style).
- Add a memory note under `mem://constraints/itinerary/` titled **schedule-coherent-copy** documenting the rule, the scrubber, and the 4 wire points so future leaks get fixed at the same boundary.

---

### Out of scope

- Regeneration of dropped sentences (we strip, we don't refill — same policy as fragment scrub).
- Cross-day references ("tomorrow's flight") — already handled by `Day-End Hotel-Return Bookend` + departure logic.
- Restructuring the prompt; only one rule line is added.

### Files touched

- `supabase/functions/_shared/prompt-leak-scrub.ts` — add `scrubPhantomEventRefs`
- `supabase/functions/_shared/scrub-activity.ts` — accept `daySchedule`, compose new scrubber
- `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts` — new tests
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — 1 rule line near 1350
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — pass `daySchedule` to `scrubActivity`
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — soft `phantom_event_reference` finding
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — pass `daySchedule` in `normalizeDays`
- `src/lib/itinerary/activityNameSanitizer.ts` — accept + forward day context
- `mem://constraints/itinerary/schedule-coherent-copy` (+ index update)
