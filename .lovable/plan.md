

## Multi-City Itinerary — Full End-to-End Audit

### Pipeline Traced

```text
Start.tsx (Form/Chat) → multi-city destinations → trip insert (is_multi_city=true)
→ trip_cities insert (per-city rows) → splitJourneyIfNeeded (8+ days, 2+ cities)
→ Journey split: original trip cancelled, N leg trips created
→ Navigate to first leg → TripDetail ?generate=true
→ ItineraryGenerator → Credit gate (charges ALL days upfront on leg 1)
→ generate-itinerary edge function (generate-trip action)
→ Per-day generation with multiCityDayMap context
→ Stage 6 final save → triggerNextJourneyLeg (self-chaining)
→ Next leg: queued → generating → ready (repeat chain)
→ Frontend: useGenerationPoller + isQueuedJourneyLeg polling
→ EditorialItinerary per-leg → JourneyUpNext card → JourneySpendingSummary
```

### Working Well

1. **Journey split logic** — Clean separation: 8+ days with 2+ cities triggers split into linked leg trips sharing a `journey_id`. Original trip cancelled with audit trail. Collaborators and members correctly copied to all legs.
2. **Sequential chaining** — `triggerNextJourneyLeg()` fires after Stage 6 completes, invoking `generate-trip` for the next queued leg via service-role auth bypass.
3. **Frontend queue polling** — `TripDetail.tsx` detects `isQueuedJourneyLeg` and polls both current leg status and previous leg readiness. Stuck-leg self-heal with 3-minute timeout.
4. **Chain failure recovery** — `chain_broken_at_day` backend signal, `resumeInFlight` concurrency lock, auto-resume up to 3 attempts before showing stalled UI.
5. **Transition day prompts** — Full 3-part skeleton (origin morning, transit, destination evening) via `buildTransitionDayPrompt()`. Transport mode look-ahead prevents airport hallucinations for non-flight legs.
6. **Per-city hotel injection** — Hotels from `trip_cities.hotel_selection` injected into generation prompts with geographic anchoring, check-in/checkout constraints, and negative hotel substitution rules.
7. **Budget split across legs** — `budget_total_cents` proportionally distributed based on nights per city.
8. **Transport cascade** — `runCascadeAndPersist` handles both single and multi-city (passes `cities` param for inter-city transport awareness).
9. **JourneyUpNext card** — Correctly links to next leg with transport mode icon and dates.
10. **JourneySpendingSummary** — Cross-leg payment overview on Payments tab.
11. **All edge functions operational** — No broken functions detected.

### Gaps Found

#### **GAP 1: `JourneySpendingSummary` reads `trip_payments`, not `activity_costs`** (MEDIUM)

The `JourneySpendingSummary` component queries `trip_payments` table for per-leg spending. But the canonical financial source is `activity_costs` (via `v_trip_total`). If no manual payments exist, the journey summary shows $0 for every leg even when `activity_costs` has real expected spend data. This makes the cross-leg spending overview useless until users manually mark items as paid.

**Fix**: Query `activity_costs` (or the `v_trip_total` view) alongside `trip_payments` to show expected spend per leg, not just paid amounts.

#### **GAP 2: Hotel patch only targets one trip, not journey legs** (MEDIUM)

`patchItineraryWithHotel()` accepts a single `tripId`. For journey legs, each leg is its own trip. If a user adds a hotel via `AddBookingInline` for leg 2, the patch correctly targets leg 2's `itinerary_data`. However, the **hotel save path** has a subtle issue: when `cityId` is provided (multi-city), the hotel saves to `trip_cities.hotel_selection`, but the `patchItineraryWithHotel` call still uses `tripId` — which is correct since each journey leg IS its own trip. This works as designed. No gap here.

#### **GAP 3: Flight added on leg 1 doesn't affect leg N departure** (LOW)

When a user adds a flight on the original (pre-split) trip, the `flight_selection` is only copied to leg 1 via `splitJourneyIfNeeded` (line 171). If the user later adds a return flight on leg N (last leg), the flight data goes to leg N's trip but the `cascadeTransportToItinerary` logic may not handle the last-day departure correctly since the return flight is stored on a different trip than where the itinerary shows.

Actually, re-reading: `AddBookingInline` receives the current trip's `tripId`, so if user is on leg 3 and adds a flight, it saves to leg 3's `flight_selection` and cascades to leg 3's itinerary. This works correctly per-leg.

#### **GAP 4: `triggerNextJourneyLeg` metadata overwrite** (MEDIUM)

When the chain trigger fails (lines 6625-6631), it overwrites the entire `metadata` field:
```typescript
metadata: {
  chain_error: `Backend returned ${res.status}`,
  chain_error_at: new Date().toISOString(),
},
```
This replaces ALL existing metadata (mustDoActivities, splitFromTrip, journeyLeg, etc.) with just the error fields. This means if generation is retried, all per-leg must-do activities and personalization context is lost.

**Fix**: Merge error fields into existing metadata instead of replacing: `{ ...existingMetadata, chain_error: ... }`.

#### **GAP 5: Journey legs don't inherit `generation_rules` or `constraints`** (MEDIUM)

`splitJourneyIfNeeded` copies `metadata.mustDoActivities` split by city keyword matching. But it does NOT copy:
- `generation_rules` (time blocks, avoidances, pacing preferences)
- `constraints` from the Fine-Tune step
- `transportation_preferences`
- `dietary` restrictions

These fields exist on the original trip but are not propagated to leg trips. The generation edge function reads these from the leg's trip row, finding them null, and generates without the user's personalization constraints.

**Fix**: Copy `generation_rules`, `constraints`, `transportation_preferences`, and relevant preferences fields from the original trip to each leg trip during the split.

#### **GAP 6: Credits charged once on leg 1 but no guard on leg N** (LOW)

All journey legs after leg 1 are invoked with `creditsCharged: 0`. The `triggerNextJourneyLeg` correctly passes this. However, there's no DB-level guard preventing a malicious or buggy re-invocation from charging credits again on leg 2+. The credit gate in `useGenerationGate` does check this, but the self-chaining backend path bypasses the frontend gate entirely.

This is low severity since the service-role bypass is only used for internal chaining, but worth noting for defense-in-depth.

#### **GAP 7: `allocated_budget_cents` not set on journey leg `trip_cities` rows** (LOW)

In `splitJourneyIfNeeded` (line 278-301), `trip_cities` rows are created for each leg but `allocated_budget_cents` is never set. The form path in `Start.tsx` (line 2543-2548) does set this for non-split multi-city trips, but after the split, the per-city budget allocation is only on the parent trip's `trip_cities` rows (which belong to the now-cancelled original trip).

Each leg trip gets `budget_total_cents` set proportionally (line 167-168), but the leg's `trip_cities` row has no `allocated_budget_cents`. This means budget-per-city views that query `trip_cities.allocated_budget_cents` show $0.

**Fix**: Set `allocated_budget_cents` on each leg's `trip_cities` row equal to the leg's `budget_total_cents`.

### Recommendations — Priority Order

1. **Fix metadata overwrite in `triggerNextJourneyLeg`** — Merge errors into existing metadata to preserve must-dos and personalization
2. **Propagate generation rules to journey legs** — Copy constraints, dietary, transportation_preferences during split
3. **Fix `JourneySpendingSummary` to use `activity_costs`** — Show expected spend, not just payments
4. **Set `allocated_budget_cents` on leg `trip_cities`** — Budget per-city accuracy
5. **No regressions** — All previous fixes (cost sync, pacing, hotel/flight patches, dedup, optimistic locking) remain intact and unmodified

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 4 (metadata overwrite) | `supabase/functions/generate-itinerary/index.ts` (lines 6625-6645) |
| GAP 5 (generation rules) | `src/utils/splitJourneyIfNeeded.ts` (lines 157-198) |
| GAP 1 (journey spending) | `src/components/itinerary/JourneySpendingSummary.tsx` |
| GAP 7 (allocated_budget) | `src/utils/splitJourneyIfNeeded.ts` (lines 278-301) |

