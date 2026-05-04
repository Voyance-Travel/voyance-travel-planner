# Fix Restaurant Pricing & Day 4 Departure Logistics

Trip affected: **Trip to Paris** (May 7–10, 2026), 2 travelers.

## Problems found

### 1. Restaurant pricing is wrong on multiple entries

Inspecting the itinerary on this trip:

- **Lunch at L'Arpège — $250 (for 2 travelers).** L'Arpège is a 3‑Michelin restaurant; the lunch tasting alone is ~€220 / person and the full lunch experience runs higher. $250 total for two is wildly under real cost.
- **Breakfast at Café de Flore — $12.** Description text says "Breakfast at Le Bristol – Epicure" (a totally different, 3‑Michelin venue). Either the venue or the price is wrong; both as-is is misleading.
- Other dining entries on Days 1–3 should be re-checked against the cost reference table for the same per-traveler scaling issue.

Per project rules, costs must come from the `cost_reference` table — not AI guesses — and must be scaled by traveler count and rounded to the nearest $5.

### 2. Day 4 departure logistics are chaotic

Day 4 currently looks like this:

```text
08:30  Breakfast at Café de Flore
09:30  Walk to Petit Palais
10:10  Petit Palais
11:25  Walk to Four Seasons George V
11:43  Checkout from Four Seasons George V
12:13  Travel to Hôtel de Crillon - Les Ambassadeurs   <-- different hotel
15:00  Transfer to the Airport (synthetic departure)
17:53  Dinner at Les Ambassadeurs                      <-- AFTER airport transfer
```

Issues:

- Dinner at 17:53 is scheduled **after** the 15:00 airport transfer.
- Guest checks out of Four Seasons George V, then travels to a **different hotel** (Hôtel de Crillon) just to dine — this isn't a hotel switch, it's the departure day.
- No "Return to hotel for bag pickup" or proper bag-drop sequencing.
- Violates the Logistics Mandate (departure buffer: 180m for flights — anything starting after the buffer window must be removed) and the Hard Constraint Enforcement rule (immovable departures).

## Fix plan

### A. Correct restaurant pricing on the affected trip

1. For each dining activity on the trip, look up canonical pricing in `cost_reference` (or the closest matching tier when a specific venue isn't present) and scale by `travelers = 2`, rounded to the nearest $5.
2. Update both `cost.amount` and `estimatedCost.amount` on each activity in `itinerary_data` so UI fallbacks and the activity_costs snapshot stay consistent.
3. Fix the Café de Flore description text so it no longer references "Le Bristol – Epicure".
4. Specifically reprice: L'Arpège lunch, Café de Flore breakfast, and any other dining entry whose current value looks anomalous against the reference table.

This is a data correction, executed via the database insert/update tool against `trips.itinerary_data` for trip `7ea828ac-9db5-42e7-b9a2-daeed10dd71f`. No schema change.

### B. Repair Day 4 departure flow

Rebuild Day 4 around the departure as a hard anchor:

```text
08:30  Breakfast at Café de Flore
09:30  Walk to Petit Palais
10:10  Petit Palais
11:25  Walk back to Four Seasons George V
11:45  Hotel checkout + bag drop (luggage held at hotel)
12:15  Lunch near the hotel (light, ~75 min) — replaces the misplaced
       "Travel to Hôtel de Crillon - Les Ambassadeurs"
13:45  One short final activity OR free time near the hotel
14:30  Return to Four Seasons George V to collect bags
15:00  Airport transfer (existing synthetic departure, locked)
```

Concretely:

- **Remove** "Travel to Hôtel de Crillon - Les Ambassadeurs" and the "Dinner at Les Ambassadeurs" entry — both fall after/around the immovable 15:00 departure and the latter starts well past the 180-minute departure buffer.
- **Insert** a "Return to hotel for bag pickup" entry before the 15:00 transfer (per the Itinerary Logistics Mandate).
- **Optionally insert** a light lunch venue near George V (sourced from the existing restaurant pool, not duplicating earlier days) using `cost_reference` pricing.
- Keep the synthetic `final-departure-4` airport transfer locked and unchanged.

This is also a data correction on `itinerary_data` for the same trip.

### C. Sanity check Days 1–3

While editing, scan Days 1–3 dining entries and apply the same pricing correction pass so the trip's totals are coherent. No structural changes to those days.

D. Make a fix for all generations not just one trip

## Technical notes

- All edits are JSONB updates to `trips.itinerary_data` for trip id `7ea828ac-9db5-42e7-b9a2-daeed10dd71f` via the insert/update tool. No migrations.
- Pricing source of truth: `cost_reference` table (Paris, dining tier matching each venue). Never estimate.
- Round each scaled price to the nearest $5.
- Preserve any activity flagged `isLocked: true` or originating from manual entry — only the AI-generated entries listed above will be touched.
- After the edit, the activity_costs snapshot used by the UI total-cost logic will reflect the corrected values automatically.

## Out of scope

- No changes to the generation pipeline or edge functions in this pass — this is a targeted data fix on one trip. If the same pricing class of bug shows up on other trips, a follow-up task can harden the cost lookup in `generate-itinerary`.