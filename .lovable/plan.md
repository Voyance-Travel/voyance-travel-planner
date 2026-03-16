Problem: yes, your instinct is right. The current system is not treating “closed” as a hard failure. It treats it as a warning, which is why closed venues still make it into the final itinerary.

What I found:

- In generation, the prompt tells the model not to schedule closed places, but also says that if it’s unsure it can set `closedRisk: true`.
- After generation, the backend validates opening hours using verified venue data.
- If a time conflict can be fixed, it shifts the activity time.
- If the venue is actually closed that day, or the slot still doesn’t fit, the code only marks:
  - `closedRisk = true`
  - `closedRiskReason = ...`
- The frontend then just renders a warning badge: “May be closed”.
- I did not find any backend step that replaces, removes, or regenerates those closed activities before the itinerary is shown.

Why this keeps happening:

1. “Closed” is currently modeled as non-blocking.
2. The post-validation layer is fail-open: it preserves the activity instead of swapping it out.
3. The single-day regeneration path behaves the same way, so the issue persists in rewrites too.
4. The fallback instruction `closedRisk + alternative` exists in the prompt guidance, but there is no enforcement path that actually uses that alternative.

Recommended fix:

1. Make true closures a hard rejection

- If verified hours say the venue is closed on that day, keep it in the final itinerary just at an open time. 
- Only keep warning states for uncertain/missing-hours cases, not confirmed closures.

2. Split “uncertain” from “confirmed closed”

- Keep `closedRisk` only for incomplete data.
- Add a stricter internal branch for confirmed closed venues from verified opening-hours data.

3. Add automatic replacement in Stage 4.5

- When validation finds a confirmed closure:
  - first try shifting time if the venue is open later that same day
  - if closed all day, replace the activity with a similar venue in the same category, neighborhood, budget, and DNA vibe
  - if replacement fails, trigger targeted regeneration for that slot/day
- This should happen before the itinerary is persisted.

4. Apply the same rule to single-day regeneration

- The `generateSingleDayWithRetry` flow currently only tags `closedRisk`.
- It should use the same replacement/removal logic so edits don’t reintroduce closed items.

5. Tighten prompt contract

- Update the generation prompt so “confirmed closed from known hours” is a generation failure, not something the model can leave behind.
- Reserve “closedRisk” for incomplete verification only.

6. Improve UI semantics

- Confirmed closed venues should never appear in the user-facing itinerary.
- If a fallback replacement had to be used, optionally show a subtle “updated due to venue hours” note instead of a scary warning.

Files involved:

- `supabase/functions/generate-itinerary/index.ts`
  - change Stage 4.5 auto-fix from “tag and continue” to “replace/regenerate”
  - change single-day generation closed-hours handling near the current `closedRisk` tagging
- `supabase/functions/generate-itinerary/truth-anchors.ts`
  - keep the validator, but distinguish confirmed closures vs unknown/uncertain cases
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/components/itinerary/FullItinerary.tsx`
  - update rendering so only uncertainty warnings remain, not known-closed recommendations

Expected outcome:

- Known-closed venues stop appearing in itineraries.
- Only ambiguous cases get a warning badge.
- Full generation and day rewrites behave consistently.
- The itinerary feels much more trustworthy and less self-contradictory.

Technical note:
Right now the bug is architectural, not just copy/UI. The backend already knows when some venues are closed; it simply chooses to preserve them. The most important implementation change is to turn that branch from “annotate” into “repair or regenerate”.