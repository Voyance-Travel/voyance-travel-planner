

## Fix: Make AI Saved Notes Visible on Activity Cards

### Problem
AI Notes are saving correctly and persisting to the database, but they're hidden behind a **collapsed accordion** that defaults to closed. The small "✨ AI Notes (1)" toggle blends into the card and is easy to miss — especially right after saving, when the user expects to see the note immediately.

### Fix

**File: `src/components/itinerary/AISavedNotes.tsx`**

1. Change the default state from collapsed to **expanded** — `useState(true)` instead of `useState(false)`. Users who just saved a note should see it immediately on the card without hunting for it. They can still collapse it if they want.

That's a one-line change: line 14, `useState(false)` → `useState(true)`.

### Files Changed
1. `src/components/itinerary/AISavedNotes.tsx` — default accordion to open

