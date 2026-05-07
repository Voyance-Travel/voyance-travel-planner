## Bug
A transit card titled "Walk to Lunch in San Polo" is showing as a $20 paid line in **All Costs**. Walking is always free — and a transit leg should never be billed regardless of where its title's "to …" destination points.

## Root cause
We have walk/mode guards in three writers, but they all gate on `category === 'transport'` first. When the AI (or a repair pass) writes the row with the wrong category — here the title contains "Lunch" so the row gets stored as `category: 'dining'` — every guard is bypassed:

1. `supabase/functions/generate-itinerary/generation-core.ts` (line ~3194) — `isWalk` check fires only after `categoryMap` runs, but the wider title-keyword branch ("walk to", "stroll", "neighborhood walk") catches it. However, the upstream day-validation/repair sometimes reclassifies the card to `dining` after this pass, leaving the costed row carrying a paid category.
2. `supabase/functions/generate-itinerary/action-repair-costs.ts` (line ~391) — the walk guard is `category === 'transport' && /^walk\b/`. If category is `dining` it falls into the dining estimator → ~$20.
3. `src/hooks/usePayableItems.ts` — transit-skipping branch only runs when `cat ∈ TRANSIT_CATEGORIES`. A walking row miscategorised as `dining` is rendered as a normal payable line.

There's also no shared "is this a walking leg" predicate — the regex is duplicated in 4+ places, which is why one writer can drift while the others stay correct.

## Fix
Make "walking is free" a category-agnostic invariant enforced at every write/read boundary, by extracting one predicate and calling it from all three layers.

### 1. Add a shared predicate (frontend)
`src/lib/cost-estimation.ts` — export `isWalkingLeg(activity)` that returns true when:
- title or description matches `^\s*(walk|stroll)\b` OR `\bwalking\s+(to|tour|along|through)\b`
- AND the activity isn't a booked guided walking tour (`booking_required === true` AND title contains "tour" → not free; everything else walking is free)

### 2. Edge-side mirror
`supabase/functions/_shared/` — add a tiny `walking-leg.ts` with the same regex, imported by:
- `generate-itinerary/generation-core.ts` Phase 4 cost-row writer (replace the inline `isWalk` block at ~line 3195).
- `generate-itinerary/action-repair-costs.ts` — apply the walk guard **before** the category branch, not after, so a mis-categorised "Walk to Lunch …" still snapshots `$0` with `source: 'walking_free'`. Drop the `category === 'transport'` precondition on the existing guard at line 391.
- `generate-itinerary/action-generate-trip-day.ts` and `backfill-activity-costs/index.ts` — same guard prepended to their cost-write loops (currently neither has it).

Source label on every walk row → `'walking_free'`, notes → `'[Walking — free]'`. Confidence `'high'`.

### 3. Read-side defense
`src/hooks/usePayableItems.ts`:
- Before the `TRANSIT_CATEGORIES` branch (~line 420), call the new `isWalkingLeg` predicate against `lookup.name`/`lookup.category`/`a.description`. If true → skip the row entirely (don't add to transit bucket either; walks shouldn't appear under "Local transit — Day N" with $0 noise).
- Also apply inside the JSON-walk fallback (~line 532) right next to the existing `isPlaceholderDepartureTransfer` and `isUnconfirmedIntraCityTaxi` skips.

`src/services/canonicalCostRows.ts` — apply the same skip in `resolveCanonicalCostRows` so the header `useTripFinancialSnapshot` total agrees with Payments. Without this, the header would still include the $20 even after Payments hides it.

### 4. One-shot DB cleanup
Migration to zero-out existing bad rows so users on the affected trip see the fix immediately:

```sql
UPDATE activity_costs ac
SET cost_per_person_usd = 0,
    source = 'walking_free',
    notes = '[Walking — free]',
    confidence = 'high'
FROM trips t, jsonb_array_elements(t.itinerary_data->'days') AS d,
     jsonb_array_elements(d->'activities') AS a
WHERE ac.trip_id = t.id
  AND ac.activity_id::text = a->>'id'
  AND ac.cost_per_person_usd > 0
  AND (
    a->>'title' ~* '^(walk|stroll)\b'
    OR a->>'title' ~* '\bwalking\s+(to|along|through)\b'
  )
  AND NOT (a->>'title' ~* '\bwalking\s+tour\b' AND (a->>'booking_required')::boolean IS TRUE);
```

### 5. Tests
- `src/lib/__tests__/isWalkingLeg.test.ts` — covers "Walk to Lunch in San Polo", "Walk to Trastevere", "Stroll along the Seine", "Morning walk", and the negative case "Guided Walking Tour of the Vatican" (booked).
- Extend `supabase/functions/generate-itinerary/__tests__/` (or co-located) to assert `action-repair-costs` writes $0 for a walk row arriving with `category: 'dining'`.
- Extend `src/hooks/__tests__/usePayableItems.test.ts` with a fixture row `{title: "Walk to Lunch in San Polo", category: "dining", cost_per_person_usd: 20}` and assert it's filtered out of both per-day rows and the grand total.

## Memory update
Add a Core rule:
> Walking legs (title starts with "walk"/"stroll" or matches "walking to/along/through", excluding booked walking tours) MUST snapshot $0 regardless of stored category.

## Files touched
- `src/lib/cost-estimation.ts` (new export)
- `supabase/functions/_shared/walking-leg.ts` (new)
- `supabase/functions/generate-itinerary/action-repair-costs.ts`
- `supabase/functions/generate-itinerary/generation-core.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/backfill-activity-costs/index.ts`
- `src/hooks/usePayableItems.ts`
- `src/services/canonicalCostRows.ts`
- new migration + tests
