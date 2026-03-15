

## Multi-City Itinerary — Deep Generation & Feature Audit

### Pipeline Health Summary

The multi-city generation pipeline, journey split logic, sequential chaining, and all editing lanes are functional. Previous fixes (metadata merge, constraint propagation, allocated_budget_cents, $0 cost rows, booking-changed event, optimistic updates) are all in place. **No broken edge functions. No regressions from prior fixes.**

However, I found **3 gaps** — one of which silently undoes the $0 cost row fix during frontend edits.

---

### GAP 1: Frontend Cost Sync Skips $0 Activities (MEDIUM)

In `EditorialItinerary.tsx` line 1321, `syncBudgetFromDays` filters with `if (costVal > 0)`, meaning free activities are excluded from the re-sync. The generation edge function now correctly inserts $0 rows, but any direct edit (drag, remove, Discover swap, manual add) triggers `syncBudgetFromDays` which does a delete-and-reinsert cycle — **deleting the $0 rows and not re-creating them**.

This silently undoes the data completeness fix (GAP 3 from previous round) after any frontend edit.

**Fix**: Change `if (costVal > 0)` to `if (costVal >= 0)` and include `$0` activities in the sync array. This ensures free activities retain their `activity_costs` rows after edits.

**Files**: `src/components/itinerary/EditorialItinerary.tsx` (line 1321)

---

### GAP 2: `splitJourneyIfNeeded` Writes Redundant Snake-Case Metadata Keys (LOW — Cleanup)

Lines 148-152 explicitly write `generation_rules`, `constraints`, `transportation_preferences`, `dietary`, `pacing` in snake_case. But the edge function reads `generationRules` (camelCase) from `trip.metadata.generationRules` (line 1264). The spread `...metadata` already copies the original camelCase keys from the parent trip, so the explicit snake_case writes are dead code that adds noise to the metadata object.

**Fix**: Remove the 5 explicit snake_case lines (148-152) since the spread already handles propagation. This is a cleanup — no functional impact since the camelCase originals are already preserved.

**Files**: `src/utils/splitJourneyIfNeeded.ts` (lines 148-152)

---

### GAP 3: `ItineraryAssistant` Chat Cost Sync Also Skips $0 (LOW — Same Root Cause as GAP 1)

The `ItineraryAssistant.tsx` cost sync path likely has the same `costVal > 0` filter. If confirmed, the fix mirrors GAP 1.

**Fix**: Verify and update the same pattern in `ItineraryAssistant.tsx` to include `$0` activities.

**Files**: `src/components/itinerary/ItineraryAssistant.tsx`

---

### Verified Working (No Gaps)

| Area | Status |
|------|--------|
| Journey split (8+ days, 2+ cities) | ✅ Correct split, linked legs, journey_id |
| Sequential chaining (triggerNextJourneyLeg) | ✅ Metadata merge on error, constraint propagation |
| Multi-city day map (trip_cities → dayMap) | ✅ Per-city hotel, transport, transition days |
| Per-city budget allocation | ✅ allocated_budget_cents set on leg trip_cities |
| Collaborator/member copy to legs | ✅ Both tables copied during split |
| Blended DNA for journey legs | ✅ Edge function loads collaborators per-leg trip |
| Transition day prompts | ✅ 3-part skeleton, transport look-ahead |
| Per-city hotel injection | ✅ From trip_cities.hotel_selection |
| Chat editing (itinerary-chat) | ✅ Scoped per-leg, rewrite_day works |
| Discover proactive | ✅ Blended DNA passed, per-leg scoped |
| Flight/hotel patch post-gen | ✅ Per-leg targeting, optimistic saves |
| JourneySpendingSummary | ✅ Uses activity_costs + trip_payments |
| booking-changed event dispatch | ✅ From AddBookingInline |
| Generation status update | ✅ trip_cities.generation_status → 'generated' |
| No-shrink guard | ✅ Blocks day truncation |
| All edge functions | ✅ No broken functions |

### Recommendations — Priority Order

1. **Fix $0 activity sync in EditorialItinerary** — Prevents silent deletion of free activity cost rows
2. **Fix $0 activity sync in ItineraryAssistant** — Same root cause
3. **Remove dead snake_case metadata keys from splitJourneyIfNeeded** — Code cleanup

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 1 ($0 sync) | `src/components/itinerary/EditorialItinerary.tsx` (line 1321) |
| GAP 2 (cleanup) | `src/utils/splitJourneyIfNeeded.ts` (lines 148-152) |
| GAP 3 ($0 sync) | `src/components/itinerary/ItineraryAssistant.tsx` |

