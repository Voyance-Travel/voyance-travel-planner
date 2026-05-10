## Bug

AI Concierge "Save as note" flips React state and shows the toast, but the note disappears after closing the sheet, on refresh, and on reopen. The Stack Overflow trace is right about the symptom but **wrong about the storage target** for this codebase — activities here live in `trips.itinerary_data.days[*].activities[*]` (JSONB), not in a `trip_activities` table.

## Trace (verified against actual code)

| Step | What happens | Where |
|---|---|---|
| Save click | `handleSaveNote` → `onSaveNote(activity.id, note)` | `ActivityConciergeSheet.tsx:241-264` |
| Handler | `setDays(...)` adds `aiNotes` to the matching activity, then `setHasChanges(true)` | `EditorialItinerary.tsx:2776-2788` |
| Persist | **No direct DB write.** Autosave `useEffect` fires 3 s after `hasChanges` flips, calls `save-itinerary` edge action with the full `days` blob | `EditorialItinerary.tsx:3992-4064` |
| Sheet props | The activity object passed to `<ActivityConciergeSheet>` is hand-mapped; **`aiNotes` is omitted** from that object | `EditorialItinerary.tsx:8246-8263` |
| Read back | `parseSingleActivity` spreads raw `...activityData` first, so `aiNotes` survives parse | `src/utils/itineraryParser.ts:415-462` |
| Backend save | `normalizeDays` / `scrubActivity` mutate in place; nothing strips `aiNotes`. `persistTripItinerary` writes the full payload to `trips.itinerary_data` | `supabase/functions/generate-itinerary/action-save-itinerary.ts:122-156, 821-843` |

### Why the user sees the note disappear

There are **three real failure modes**, in priority order:

1. **3-second autosave race.** The user clicks Save → toast → X out within 3 s → leaves the page (or any refetch fires a fingerprint-id-only mismatch path). If the autosave timer didn't fire, the note never reached the DB. On reload it's gone.

2. **Parent-driven reset wipes uncommitted aiNotes.** `initialDaysFingerprint` at `EditorialItinerary.tsx:2227-2242` keys only on `dayNumber/date/activity.id` — so a parent refetch that returns the *same activity ids* never triggers `setDays(initialDays)`. Good. **But** `setHasChanges(false)` runs immediately after autosave succeeds, and the next parent refetch *will* pass through if the fingerprint differs for any unrelated reason (e.g. a new activity added elsewhere) — at which point the parent's `initialDays` overwrites `days`. If the parent fetched before the autosave reached the DB, the new `initialDays` has no `aiNotes` and the in-memory note is dropped.

3. **Sheet doesn't know about saved notes.** Lines 8246-8263 build a flattened activity object for the sheet that **omits `aiNotes`**. The "saved indicator" relies on `conciergeSavedNoteContents` (computed from `days[]`), which works *within session* — but the sheet's internal scroll-to-saved-note / highlight code (and any feature that reads `activity.aiNotes` directly) sees an empty array.

The card's inline `<AISavedNotes>` block at line 11413 reads `activity.aiNotes` from the day state, so it *should* show after save. If the user reports it doesn't appear visibly even before closing, the card likely re-rendered from a stale `activityToRender` (line 10405) — which is the raw `activity` and should be fine, so this is probably a perception issue caused by the note disappearing on the next refetch (failure mode 1 or 2).

## Fix — narrow, three layers

### 1. Persist immediately (kill the 3-second race)

Change `handleSaveAINote` and `handleDeleteAINote` (`EditorialItinerary.tsx:2775-2799`) to `async`. After the `setDays` state update, **await** a save call instead of relying on the autosave timer.

Use the existing `save-itinerary` edge action so the note travels through the same normalization pipeline as everything else (no schema change, no new RLS):

```ts
const handleSaveAINote = useCallback(async (activityId, note) => {
  let nextDays: EditorialDay[] = [];
  setDays(prev => {
    nextDays = prev.map(day => ({
      ...day,
      activities: day.activities.map(act => {
        if (act.id !== activityId) return act;
        const existing = act.aiNotes || [];
        if (existing.some(n => n.content === note.content)) return act;
        return { ...act, aiNotes: [...existing, note] };
      }),
    }));
    return nextDays;
  });
  setHasChanges(true);

  // Immediate persistence — bypass the 3 s autosave debounce.
  // Skip for localStorage demo trips (no edge function path).
  try {
    const { data: existing } = await supabase
      .from('trips').select('id').eq('id', tripId).maybeSingle();
    if (existing) {
      await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'save-itinerary',
          tripId,
          itinerary: { days: nextDays, status: 'ready', optionSelections, savedAt: new Date().toISOString() },
        },
      });
      setHasChanges(false);
      setLastSaved(new Date());
    }
  } catch (e) {
    // Leave hasChanges=true so the autosave timer retries
    console.warn('[AI note] immediate persist failed; will retry via autosave', e);
  }
}, [tripId, optionSelections]);
```

Mirror the same pattern in `handleDeleteAINote`.

For localStorage demo trips, fall back to the same write block the autosave uses (lines 4040-4056) so demo users also get instant persistence.

### 2. Pass `aiNotes` into the sheet's activity prop

`EditorialItinerary.tsx:8246-8263` — add `aiNotes: conciergeActivity.aiNotes` to the mapped object. Source it from the **live** day (so it reflects post-save state), not the snapshot:

```ts
activity={{
  id: conciergeActivity.id,
  // ...existing fields...
  aiNotes: (() => {
    for (const day of days) {
      const live = day.activities?.find(a => a.id === conciergeActivity.id);
      if (live) return live.aiNotes || [];
    }
    return conciergeActivity.aiNotes || [];
  })(),
}}
```

This guarantees the sheet sees current notes when it reopens — the existing `savedNoteContents` Set keeps working as the bookmark-icon source. Then update `ActivityConciergeSheet`'s `ConciergeActivity` type (`ActivityConciergeSheet.tsx:43-56` area) to accept the optional `aiNotes` field.

### 3. Refresh `conciergeActivity` snapshot when `days` updates while sheet is open

The `conciergeActivity` state is set once at open time (`EditorialItinerary.tsx:2763`). After saving, the sheet's outer reference is stale. Add a `useEffect` that, when the sheet is open, re-derives `conciergeActivity` from `days` whenever `days` changes for the open activity's id:

```ts
useEffect(() => {
  if (!conciergeOpen || !conciergeActivity) return;
  for (const day of days) {
    const live = day.activities?.find(a => a.id === conciergeActivity.id);
    if (live && live !== conciergeActivity) {
      setConciergeActivity(live);
      return;
    }
  }
}, [days, conciergeOpen, conciergeActivity]);
```

This makes save → reopen-without-closing show the just-saved note inside the sheet.

### Out of scope

- No new `trip_activities` table writes — that table is not the source of truth in this app.
- No new schema, no migration, no RLS changes (notes ride inside `itinerary_data` JSONB which already has policies).
- No backend changes — `save-itinerary` already preserves unknown activity fields end-to-end.
- No changes to autosave debounce; it stays as a safety net.

### Why this fixes "bad pricing" too

Layer 1 is the price-leak fix: every saved note is committed to the DB before the user has a chance to navigate away, so the regenerate-and-pay-twice path goes away.

### Verification

1. Save a note → DevTools Network shows `POST .../generate-itinerary` with `action: 'save-itinerary'` *immediately*, not after 3 s.
2. Save → close sheet → hard refresh → note still on card.
3. Save → reopen sheet (without closing) → bookmark stays "saved", note is in the saved-notes list in the sheet.
4. Delete a note → refresh → stays deleted.
5. Demo trips: localStorage entry contains `aiNotes` after save, survives reload.

### Files

- `src/components/itinerary/EditorialItinerary.tsx` — async save/delete handlers, sheet prop hydration, snapshot refresh effect
- `src/components/itinerary/ActivityConciergeSheet.tsx` — extend `ConciergeActivity` type with optional `aiNotes`
- (no other files; backend, schema, parser, types/itinerary.ts are already correct)