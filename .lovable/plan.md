## Add PRE/POST-VALIDATE counts logging in `action-save-itinerary.ts`

Add a small helper and 3 log lines so we can correlate any future erosion report to the exact mutation step (meal-guard vs ledgerCheck) that drops dining cards.

### Helper (top of file, near other utils)
```ts
const countDays = (days: any[]) =>
  days.map((d: any, i: number) => {
    const acts = Array.isArray(d?.activities) ? d.activities : [];
    const dining = acts.filter((a: any) =>
      /dining|food|restaurant/i.test(String(a?.category || ''))
    ).length;
    return `day${i + 1}=${acts.length}(dining:${dining})`;
  }).join(' ');
```

### Insertion points (sequential, single file)

1. **PRE-VALIDATE** — just before STEP 2 meal-guard begins (before line 273, after `totalDays` is computed):
   ```
   console.log(`[save-itinerary] PRE-VALIDATE counts: ${countDays(itineraryDays)}`);
   ```

2. **POST-VALIDATE (meal-guard)** — immediately after the meal-guard for-loop ends (~line 499, before the `if (mealGuardInjections > 0)` summary):
   ```
   console.log(`[save-itinerary] POST-VALIDATE counts (post meal-guard): ${countDays(itineraryDays)}`);
   ```

3. **POST-VALIDATE (ledgerCheck)** — immediately after the `if (lc.removed > 0 ...)` block that re-assigns `itineraryDays = lc.days` (~line 789):
   ```
   console.log(`[save-itinerary] POST-VALIDATE counts (post ledgerCheck, skipped=${skipLedgerCheck}): ${countDays(itineraryDays)}`);
   ```

### Why these three
- PRE = baseline of what the caller sent.
- POST meal-guard = isolates injection/normalization side-effects.
- POST ledgerCheck = isolates destructive trims (the suspected erosion source). Including `skipped=` makes self-heal vs mutating saves distinguishable in one grep.

### Files touched
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (helper + 3 console.log lines, no behavior change)

### Out of scope
- No new tests (pure logging).
- No changes to other files. The existing `skipLedgerCheck` propagation, no-op fingerprint guard, and meal-row exemption from prior turns remain unchanged.

### Acceptance grep (matches the verification block in the request)
- `rg -n "PRE-VALIDATE counts|POST-VALIDATE counts" supabase/functions/generate-itinerary/action-save-itinerary.ts` → 3 hits (≥2 required).
