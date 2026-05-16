# Fix Step 3 "Anything else?" Free-Text Box

## The bug

On Start.tsx Step 3, there are two distinct UI controls but they share one state:

1. **Must-do chips / paste** (landmarks picker, custom-must-dos, paste list) — venue names
2. **"Anything else?" textarea** ("Paste notes, other AI suggestions, skip requests, or special requirements...")

Both currently write into `metadata.mustDoActivities` (Start.tsx L2504 lumps the textarea string into `formMustDoList` alongside the venue chips).

Downstream, `parseMustDoInput` treats every entry as a venue name. So when the user types something like *"Skip museums, focus on hiking and food markets, we love sunset views"*, that whole sentence becomes a single "must-do venue" and the model is told to emit it as an activity card titled with the raw sentence. The actual *intent* (skip museums, prefer hiking, prefer markets, sunsets) is never seen as guidance — it gets paste-as-activity'd or silently dropped.

Meanwhile `metadata.additionalNotes` IS the correct channel — `compile-prompt.ts` L591–600 renders it as `## 🎯 TRAVELER'S TRIP PURPOSE` and feeds it as freeform context to the model. The chat-planner path already routes free text there (Start.tsx L3078). The form path doesn't.

## The fix

### 1. Separate state for the textarea (`src/pages/Start.tsx`)

- Add `const [additionalNotes, setAdditionalNotes] = useState('')` and load/persist it alongside the existing draft state.
- Rename the existing `mustDoActivities` state usage on L3432–3433 to bind the textarea to `additionalNotes` / `setAdditionalNotes`.
- Keep `mustDoActivities` state for the legacy paste-list affordance if it's still wired (audit — it may now be vestigial after the chip picker covers that case; if so, delete the state and any references).
- Update the placeholder copy to make the role clear: *"Tell us what to optimize for — vibes, things to skip, special requests, or context we should know."*

### 2. Persist correctly on submit (`Start.tsx` L2500–2545)

- `formMustDoList` (fed to `metadata.mustDoActivities`) now contains ONLY: `selectedLandmarks` + `customMustDos`. The textarea contents are removed from this array.
- Add `additionalNotes: additionalNotes.trim() || null` to the trip insert/update payload (both form-path branches around L2511 and L2525).
- Mirror the same wiring in the chat-path block around L3072–3098 — it already writes `additionalNotes`, just make sure the new form-path field name matches.

### 3. Mirror on `ItineraryContextForm` (`src/components/planner/ItineraryContextForm.tsx`)

- The current Step-3 refine card already has a single textarea bound to `mustDoActivities`. Split it into TWO inputs:
  - **"Add a must-do (optional)"** — chips/paste, feeds `mustDoActivities` (existing parse + chip preview stays).
  - **"Anything else? (optional)"** — short textarea, feeds new `additionalNotes` field on the form's submit payload.
- Update `ItineraryContextData` type to carry `additionalNotes?: string`.
- In `ItineraryPreview.handleContextSubmit` (L317–333), add:
  ```ts
  if (data.additionalNotes) metadataUpdates.additionalNotes = data.additionalNotes;
  ```

### 4. One-shot heal for trip `82e56447-…`

The trip's persisted days still show stale duplicate "Hallasan / Cheonjiyeon / Stone Park" cards from the earlier locked-anchor bug. `userAnchors` is already cleared, but the day rows haven't been regenerated. Two options:

- **Preferred:** in-app, hit "Refresh Day" on Day 1 and Day 2 — the LLM will now place each landmark once with proper time, address, and description (anchor-guard no longer re-injects them).
- **Optional:** a targeted backend script that regenerates just the affected days for this trip.

### 5. Verify

- Open Start, set destination, on Step 3 add chips for landmarks AND type freeform notes in "Anything else?".
- After insert, query the trip row: `metadata.mustDoActivities` contains only the chip names; `metadata.additionalNotes` contains the freeform sentence.
- Edge logs: `[compile-prompt] Must-do: N total, Day k: m assigned` for venues, AND `## 🎯 TRAVELER'S TRIP PURPOSE` block rendered with the freeform text (sentinel grep `additionalNotes` in compile-prompt log).
- Generated days: venues integrated with real time/address/description; the freeform text influences day vibe but is NOT emitted as a literal activity card.

## Out of scope

- Prompt-template wording changes in `compile-prompt.ts`.
- New chip-time picker UI.
- Any change to chat-planner — it already routes both fields correctly.
