## Plan: make day-end hotel return a hard generation invariant

### What I found
- The core injector `runStep8` exists, but it runs too early in several paths.
- Later stages can add or reorder terminal cards after `runStep8`:
  - final meal guard
  - gap fill
  - validation gate
  - orphan transit cleanup
  - trip-wide finalization loop
- The final trip-wide loop only calls `terminalCleanup`; it does **not** re-add hotel returns after those later mutations.
- Recent saved trips confirm the bug: non-departure days often end on dinner/nightcap/activity/freshen-up instead of a final return card.
- Late-night cards ending after midnight are only handled when the category/title matches a narrow nightlife pattern; several real examples like `Nightcap at L'Estaminet` in category `activity` still miss the late-night return.

### Fix
1. **Create one shared finalizer** in `universal-quality-pass.ts`
   - Add `ensureDayEndHotelReturn(...)` as the canonical invariant wrapper.
   - It will:
     - skip true departure days
     - sort/identify the real terminal non-logistics activity by time, not array position
     - call `runStep8` idempotently
     - handle late-night terminal titles like `nightcap`, `cocktail`, `bar`, `speakeasy`, even when category is `activity` or `relaxation`
     - clamp standard returns to the same day and preserve legitimate late-nightlife source tags

2. **Call the finalizer after every late mutation path**
   - In `action-generate-trip-day.ts`:
     - after final meal guard / validation gate / orphan transit cleanup
     - inside the trip-wide finalization loop after `terminalCleanup`
     - before intermediate and final `persistTripItinerary` writes
   - In `action-generate-day.ts`:
     - after meal guard and terminal cleanup before single-day persistence/return
   - In `action-save-itinerary.ts`:
     - replace the ad-hoc save-time `runStep8` call with the shared finalizer so manual saves and refresh-triggered saves use the same rule.

3. **Strengthen persistence defense**
   - Update `persistTripItinerary` to run a non-destructive check before write:
     - for every non-last day with real evening content, warn if it lacks a terminal hotel return
     - do not silently drop or reorder user-locked/manual rows
   - Keep it observational unless the caller passes hotel/day context; generation paths will actively repair before reaching this boundary.

4. **Add regression tests**
   - Standard evening dinner ends at 20:15 → append `Return to ...`.
   - Nightcap category `activity` ending 00:16 after 23:16 start → append late-nightlife return and preserve it through pre-dawn strip.
   - Existing final `Freshen Up at hotel` at 17:45 is **not** treated as a day-end return when later evening content exists; if it is terminal on a non-departure day, append/normalize a true return card.
   - Departure day ending on airport/station logistics remains unchanged.
   - Re-running the finalizer is idempotent and does not duplicate return cards.

### Validation
- Run targeted edge-function tests for hotel-return/bookend behavior.
- Query recent generated trips after implementation to confirm every non-departure day ends with a visible hotel-return card or legitimate departure logistics.