

## Audit Results & Fix Plan

### What's Actually Wrong With the Paris Trip (Day 1)

I pulled the real data from your most recent Paris trip. Here's the chronological disaster on Day 1:

```text
08:30  Breakfast at Café Lumière     ← BEFORE the flight lands
11:44  Arrival Flight (CDG)          ← Flight arrives here
12:30  Lunch at Trattoria del Corso  ← DURING customs (flight ends 13:44)
14:14  Travel to Hotel
15:14  Check-in at Hotel
16:14  Louvre Exterior
17:40  Angelina
19:55  Dinner at Petit Bon
22:06  Return to Hotel               ← First return
22:56  Return to Hotel               ← DUPLICATE return
```

### Root Causes Identified

**1. Meal Guard ignores flight times (THE BIG ONE)**
The `enforceRequiredMealsFinalGuard` runs LAST in `generation-core.ts` (line 2241) and injects breakfast at 08:30 and lunch at 12:30 using hardcoded default times. It supports a timing window parameter (`options.earliestTimeMins`), but **that parameter is never passed**. The call has no `options` argument at all.

The quality pass strips pre-arrival meals earlier, but the meal guard runs AFTER the quality pass and re-injects them. Then `terminalCleanup` should catch this, but the context audit shows: *"No flight data — arrival/departure constraints will be weak"*. The `flight_selection` field is empty, so `savedArrivalTime24` is `undefined`, and every timing guard becomes a no-op.

**2. Flight data not propagated from repair to guards**
The `repair-day.ts` pipeline correctly injects the arrival flight (source: `repair-arrival-flight`) at 11:44, proving it knows the flight time. But this knowledge stays local — it's never written back to `flight_selection` in the trip metadata, so downstream guards (meal guard, terminal cleanup, universal quality pass) all see `arrivalTime24 = undefined`.

**3. Italian restaurant in Paris**
"Trattoria del Corso" is an Italian restaurant injected by the meal guard as a fallback. The destination cuisine rule we just added only applies to AI-generated content, not to the meal guard's fallback venue selection.

**4. Duplicate hotel returns**
Two "Return to Your Hotel" entries at 22:06 and 22:56. The dedup logic exists but isn't catching these because they have different IDs and slightly different times.

**5. Day 2: Overlapping Louvre + Lunch times**
Louvre ends at 13:00, but Lunch at Pink Mamma starts at 12:30 — a 30-minute overlap. The chronological sort isn't enforcing non-overlapping windows.

---

### UI Issues: Double X + Missing Note Icon

**Double X**: The `AISavedNotes` component renders an X delete button on each saved note (line 45). The `SheetContent` component renders its own X close button (line 60 of sheet.tsx). When the concierge sheet is open AND there's a saved note visible inside it, users see two X icons — one for the sheet, one for the note. However, I suspect the "double X" the user sees is actually in the **card view** itself, not the sheet. When a card shows VoyanceInsight + AISavedNotes, both components can render close/delete controls that look like duplicate X's.

**Note not visible after save**: The `conciergeSavedNoteContents` is derived from `conciergeActivity.aiNotes`, but `conciergeActivity` is a **stale snapshot** — it's set when the sheet opens and never updated when `handleSaveAINote` modifies `days`. So the bookmark icon never flips to "saved" state while the sheet is open. The note IS saved to `days` state, but the sheet doesn't reflect it.

**No note indicator on collapsed cards**: `AISavedNotes` only renders in the mobile-expanded section of the activity card. There's no badge/icon in the card header or action row to indicate "this activity has saved notes."

---

### Fix Plan

#### Fix 1: Pass flight timing to meal guard (generation-core.ts)
In `generation-core.ts` at line 2241, pass the `options` parameter with `earliestTimeMins` and `latestTimeMins` derived from the flight context that's already available in the generation scope. This prevents the meal guard from injecting breakfast at 08:30 when the flight arrives at 11:44.

#### Fix 2: Extract arrival time from repair-injected flight (action-generate-trip-day.ts + action-save-itinerary.ts)
When `savedArrivalTime24` is undefined, scan Day 1's activities for the repair-injected flight card (`source: 'repair-arrival-flight'`) and use its `endTime` as the arrival time. This ensures ALL downstream guards work even when `flight_selection` is empty.

#### Fix 3: Apply destination cuisine rule to meal guard fallbacks (day-validation.ts)
Filter the hardcoded fallback restaurants in `enforceRequiredMealsFinalGuard` to exclude obviously wrong cuisines for the destination (no "Trattoria" in Paris, no "Brasserie" in Tokyo).

#### Fix 4: Fix duplicate hotel return dedup (universal-quality-pass.ts or terminalCleanup)
In `terminalCleanup`, add a pass that keeps only the LAST "Return to Your Hotel" activity, removing earlier duplicates.

#### Fix 5: Fix stale note state in concierge sheet (EditorialItinerary.tsx)
Change `conciergeSavedNoteContents` to derive from `days` state (finding the activity by ID) instead of from the stale `conciergeActivity` snapshot. This way the bookmark icon updates immediately after saving.

#### Fix 6: Add note indicator to card header (EditorialItinerary.tsx)
Add a small Sparkles icon + count badge near the activity title or action buttons when `activity.aiNotes?.length > 0`, visible in both collapsed and expanded states.

#### Fix 7: Fix double X in AI insight area (AISavedNotes.tsx or EditorialItinerary.tsx)
If the VoyanceInsight and AISavedNotes render adjacent X-like controls, consolidate them. Change the AISavedNotes delete button to use a Trash icon instead of X to differentiate it from the sheet close button.

### Files Changed
1. `supabase/functions/generate-itinerary/generation-core.ts` — pass timing options to meal guard
2. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — extract arrival time from repair flight
3. `supabase/functions/generate-itinerary/action-save-itinerary.ts` — same fallback extraction
4. `supabase/functions/generate-itinerary/day-validation.ts` — destination cuisine filter for fallbacks
5. `supabase/functions/generate-itinerary/universal-quality-pass.ts` — duplicate hotel return cleanup
6. `src/components/itinerary/EditorialItinerary.tsx` — fix stale note state + add note indicator
7. `src/components/itinerary/AISavedNotes.tsx` — change X to Trash icon

