# Fill the Gap — backend auto-suggestion

## Goal

Today the amber "Fill the gap" banner just opens `AddActivityModal` with a blank form. Make it actually *suggest* an activity for the gap (DNA-aware, dietary-aware, budget-aware) and offer one-tap accept, while keeping manual entry as a fallback.

## UX

1. User sees amber banner: "2h 30m unplanned between A (14:00) and B (16:30)."
2. CTA changes from **"Fill the gap"** → **"Suggest something"** (primary) with a secondary **"Add manually"** link.
3. Tapping "Suggest something":
   - Spinner inline on the banner (~2-4s).
   - Returns a single proposed activity card (title, ~time window, cost, short rationale, category icon).
   - Two actions: **Add to day** (commits) and **Try another** (re-rolls, max 3 times before falling back to manual).
4. If suggestion engine fails or returns nothing usable → banner falls back to the existing "Add manually" CTA so user is never blocked.

## Backend

Add a new request shape to `supabase/functions/refresh-day/index.ts`:

```text
POST { mode: "fill_dead_gap",
       trip_id, day_number, date, destination,
       gap: { start_time, end_time, before_id, after_id },
       activities: [...current day],
       avoid_ids?: string[]   // for "Try another"
     }
→ { proposed_change: { type: "insert_activity",
                       afterIndex, activity: { ... } } }
```

Implementation notes:
- Branch at the top of the handler on `body.mode === 'fill_dead_gap'`; existing validation flow stays untouched.
- Pull profile + trait scores via the same loader `generate-itinerary` uses (`profile-loader.ts` already merges Fine-Tune overrides).
- Reuse the day-fill helper that `action-generate-day.ts` calls (one-activity prompt to Lovable AI Gateway, `google/gemini-2.5-flash`).
- Constrain the AI to:
  - Fit inside the gap window (leave a 15-min buffer either side).
  - Honor dietary + budget tier (pass through from trip).
  - Avoid duplicating any existing activity title/venue on the trip (use `cross-day-dedup` canonicalizer).
  - Respect Wellness Venue Integrity (real venue or downgrade to free).
  - Use `cost_reference` for cost (no AI estimation).
- Return $0/null cost when no real venue found rather than fabricating.

## Frontend

`src/components/itinerary/EditorialItinerary.tsx` (lines ~10117-10147):
- Replace inline "Fill the gap" button with a small `<DeadGapBanner>` component (new file `src/components/itinerary/DeadGapBanner.tsx`) that owns local state: idle → loading → suggested → applying → error.
- New hook `src/hooks/useFillDeadGap.ts` wrapping `supabase.functions.invoke('refresh-day', { body: { mode:'fill_dead_gap', ... } })`. Tracks `avoidIds` across retries.
- On accept, call existing `onAddActivity`-style commit path (build the activity object, splice at `afterIndex`, persist via existing save flow).
- Keep `onAddActivity?.(gap.beforeIndex)` as the manual fallback link.

## Tests

- `supabase/functions/refresh-day/fill_dead_gap.test.ts` — 3 cases: valid gap returns insert_activity within window; dietary restriction excluded; avoid_ids honored on retry.
- `src/components/itinerary/__tests__/DeadGapBanner.test.tsx` — loading state, accept → calls commit, "Try another" appends to avoidIds, max-retry falls back to manual CTA.

## Files

Created
- `src/components/itinerary/DeadGapBanner.tsx`
- `src/hooks/useFillDeadGap.ts`
- `supabase/functions/refresh-day/fill_dead_gap.test.ts`
- `src/components/itinerary/__tests__/DeadGapBanner.test.tsx`

Edited
- `supabase/functions/refresh-day/index.ts` — `mode: 'fill_dead_gap'` branch + reuse profile-loader + day-fill helper
- `src/components/itinerary/EditorialItinerary.tsx` — swap inline banner for `<DeadGapBanner>`

No DB migrations. No new secrets. Uses the existing Lovable AI Gateway call already wired in `action-generate-day.ts`.

## Out of scope

- Multi-suggestion picker UI (just one at a time + re-roll).
- Late-arrival window tuning (still 09:00–18:00 — separate gap).
- Budget Coach integration (banner is independent of coach swaps).
