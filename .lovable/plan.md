

## Activity Timing Management: Current State & Gaps

### How Activity Times Flow Through the System

```text
Generation (AI)
  └── Activities with startTime/endTime in HH:mm 24h format
        ↓
Post-Generation Patches
  ├── patchItineraryWithFlight → shifts Day 1 / last day around flight times
  ├── patchItineraryWithHotel → injects check-in at 15:00, cascadeFixOverlaps
  └── shiftDayAfter → removes/shifts activities after transport arrival
        ↓
User Edits (Runtime)
  ├── handleUpdateActivityTime → direct time edit + optional cascade shift
  ├── AddActivityModal → validates endTime > startTime
  ├── TimeEditModal → cascade toggle to shift all subsequent activities
  └── Drag-and-drop reorder → auto-sort chronologically
        ↓
Validation
  ├── refresh-day edge function → detects overlaps, timing gaps, buffer issues
  └── handleApplyRefreshChanges → patches startTime/endTime from proposed changes
```

### What's Working (No Gaps)

| Area | Status |
|------|--------|
| Generation outputs 24h HH:mm | Consistent |
| Hotel check-in injection at 15:00 + cascade overlap fix | Working |
| Flight patch shifts Day 1 / departure day | Working (after recent fix) |
| Time edit modal with cascade shift option | Working |
| Chronological auto-sort after time changes | Working |
| refresh-day validates buffers and overlaps | Working |
| shiftDayAfter removes post-arrival conflicts | Working |
| Departure day activity trimming (transport buffer) | Working |

### Gaps Found

#### GAP 1: `handleUpdateActivityTime` Cascade Doesn't Fix Overlaps (MEDIUM)

When a user edits an activity time with cascade enabled, `handleUpdateActivityTime` (EditorialItinerary ~line 4039) shifts all subsequent activities by a fixed delta. But it does **not** call `cascadeFixOverlaps` afterward. If the edited activity's new duration overlaps the next one, or if the delta pushes evening activities past midnight, there's no overlap correction.

By contrast, `patchItineraryWithHotel` always calls `cascadeFixOverlaps` after injection. The user-edit path skips it.

**Fix**: After the cascade shift in `handleUpdateActivityTime`, run `cascadeFixOverlaps` on the resulting activities array before setting state.

#### GAP 2: `AddActivityModal` Doesn't Cascade After Insert (MEDIUM)

When a user adds a new activity via `AddActivityModal`, it inserts at a position but does **not** shift subsequent activities or check for overlaps. If the new activity's time window overlaps existing ones, the overlap persists until the user manually runs "Refresh Day."

**Fix**: After inserting the new activity, run `cascadeFixOverlaps` on the day's activities. Alternatively, auto-trigger a lightweight overlap check and prompt the user.

#### GAP 3: `patchItineraryWithFlight` Shifts Day 1 but Doesn't Cascade Mid-Day Activities (LOW)

The flight patch adjusts arrival/departure structural activities (hotel check-in, airport transfer) but doesn't shift the remaining Day 1 sightseeing activities if the arrival pushes check-in later. Activities scheduled before the new check-in end time remain in place, creating a logical conflict (activity at 2 PM, but check-in now ends at 4 PM).

**Fix**: After patching flight-related activities, run `cascadeFixOverlaps` on the full Day 1 activity list to push sightseeing after check-in.

#### GAP 4: No Duration Recalculation on Time Edits (LOW)

When `handleUpdateActivityTime` or `handleUpdateActivity` changes startTime/endTime, the `duration` field on the activity object is **not** recalculated. The `duration` field (in minutes) can become stale — e.g., activity shows "2h" badge but times show 9:00-10:00 (1h). This is cosmetic but confusing.

**Fix**: Recalculate `duration` from the new startTime/endTime delta whenever either time field changes.

#### GAP 5: Inline Modifier (AI Rewrite) Replaces Times Without Cascade (LOW)

When the AI inline modifier rewrites activities for a day, it replaces the full activity list. If the AI output has timing gaps or overlaps, there's no post-processing `cascadeFixOverlaps` pass. The generation path has `validateGeneratedDay` but the inline modifier path does not run equivalent validation.

**Fix**: After the inline modifier returns rewritten activities, run `cascadeFixOverlaps` and a lightweight gap-check before persisting.

---

### Implementation Plan — Priority Order

1. **Add `cascadeFixOverlaps` to `handleUpdateActivityTime`** (GAP 1)
   - File: `src/components/itinerary/EditorialItinerary.tsx` (~line 4039-4070)
   - Import `cascadeFixOverlaps` from `src/utils/injectHotelActivities.ts` (needs export)
   - Apply after cascade shift, before `setDays`

2. **Add overlap check after `AddActivityModal` insert** (GAP 2)
   - File: `src/components/itinerary/EditorialItinerary.tsx` (activity add handler)
   - Run `cascadeFixOverlaps` on the day after inserting

3. **Add cascade to `patchItineraryWithFlight` Day 1** (GAP 3)
   - File: `src/services/flightItineraryPatch.ts`
   - After patching structural activities, run `cascadeFixOverlaps` on full day

4. **Recalculate duration on time edits** (GAP 4)
   - File: `src/components/itinerary/EditorialItinerary.tsx` (`handleUpdateActivityTime` + `handleUpdateActivity`)
   - Compute `duration = endTimeMins - startTimeMins` and set on activity

5. **Add post-processing to inline modifier** (GAP 5)
   - File: `src/components/itinerary/InlineModifier.tsx` (after AI response)
   - Run `cascadeFixOverlaps` on returned activities

### Files to Edit

| Fix | File |
|-----|------|
| GAP 1, 2, 4 | `src/components/itinerary/EditorialItinerary.tsx` |
| GAP 1 (export) | `src/utils/injectHotelActivities.ts` |
| GAP 3 | `src/services/flightItineraryPatch.ts` |
| GAP 5 | `src/components/itinerary/InlineModifier.tsx` |

