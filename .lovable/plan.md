## Goal

Stop self-heal save-itinerary calls when the proposed payload is identical to what's already on disk. Even with `skipLedgerCheck: true`, redundant saves still trigger `TRIP_PERSISTED_EVENT` → resync → re-render → another self-heal effect → another save. Breaking the loop at the "is this a no-op?" check is the cleanest fix.

## Approach — single chokepoint + 2 direct-invoke sites

### 1. New helper: `src/lib/itinerary/itineraryFingerprint.ts`

```ts
export function itineraryFingerprint(itin: { days?: any[] } | null | undefined): string {
  const days = Array.isArray(itin?.days) ? itin!.days : [];
  const counts = days.map(d => Array.isArray(d?.activities) ? d.activities.length : 0);
  const lenSum = days.reduce((n, d) => n + JSON.stringify(d?.activities ?? []).length, 0);
  return `${lenSum}:${counts.join(',')}`;
}
```

Stable, cheap, and matches the user's spec (length sum + per-day activity counts). Catches add/remove/reorder/text-edit at acceptable resolution for the no-op check; false-negatives only on byte-equal mutations (which by definition don't need a re-save).

### 2. Gate inside `safeUpdateItineraryData` (only when `skipLedgerCheck === true`)

After fetching `current` (line 88–92) and before the integrity guard:

```ts
if (options.skipLedgerCheck) {
  const prevFp = itineraryFingerprint(current?.itinerary_data as any);
  const nextFp = itineraryFingerprint(nextItinerary);
  if (prevFp === nextFp) {
    console.log(`[safeUpdateItineraryData] Self-heal no-op: payload identical to DB (reason=${options.reason || 'unspecified'}, fp=${nextFp}) — skipping write`);
    return { error: null };
  }
}
```

Mutating saves (no `skipLedgerCheck`) are unaffected — meal-guard / scrub / cascade may legitimately change byte-equal payloads server-side, so we never short-circuit them.

Critically: when we skip, we MUST NOT dispatch `TRIP_PERSISTED_EVENT` (skipping the dispatch is what breaks the loop). The early `return` already achieves this.

### 3. Gate at the 2 direct `supabase.functions.invoke('save-itinerary')` self-heal sites in `TripDetail.tsx`

- L1446 version-restore branch (`skipLedgerCheck: true, saveReason: 'self-heal-version-restore'`)
- L1501 empty-day-placeholder branch (`saveReason: 'self-heal-empty-day-placeholder'`)

Both already have `tripData?.itinerary_data` (or `freshItinData`/`currentItinData`) loaded as the "current" reference — no extra fetch needed. Pattern:

```ts
const nextFp = itineraryFingerprint(mergedItinerary);
const prevFp = itineraryFingerprint(currentItinData);
if (nextFp === prevFp) {
  console.log('[TripDetail] Self-heal version-restore no-op: identical to current state, skipping write');
} else {
  await supabase.functions.invoke('generate-itinerary', { body: { … } });
  queryClient.invalidateQueries(…);
  toast.success(…);
}
```

For the placeholder branch, compare against `freshItinData` (the just-fetched fresh row).

The L711 local-sync and L1322 rebuild-from-tables sites both go through `safeUpdateItineraryData`, so step 2 covers them automatically.

### 4. Test

`src/lib/itinerary/__tests__/itineraryFingerprint.test.ts`:
- identical days → identical fp
- adding an activity → different fp
- removing an activity → different fp
- editing activity text → different fp (length sum changes)
- reordering days → different fp (counts array order changes)

Plus extend `selfHealSkipsLedger.test.ts` (or add new) asserting `safeUpdateItineraryData` short-circuits when `skipLedgerCheck: true` AND fingerprints match.

### 5. Memory

Append a new bullet to `mem://constraints/itinerary/ledger-check-mutation-only`:

> **Self-heal no-op gate:** `safeUpdateItineraryData` short-circuits when `skipLedgerCheck: true` AND `itineraryFingerprint(prev) === itineraryFingerprint(next)` — and skips the `TRIP_PERSISTED_EVENT` dispatch, breaking the reload→resync→self-heal→save loop. Direct `save-itinerary` invokes in `TripDetail.tsx` (version-restore L1446, empty-day-placeholder L1501) gate on the same fingerprint before invoking. Sentinel `[safeUpdateItineraryData] Self-heal no-op` / `[TripDetail] Self-heal … no-op`.

## Files

- `src/lib/itinerary/itineraryFingerprint.ts` (new)
- `src/services/safeUpdateItineraryData.ts` (gate after fetch, only when skipLedgerCheck)
- `src/pages/TripDetail.tsx` (2 direct-invoke sites)
- `src/lib/itinerary/__tests__/itineraryFingerprint.test.ts` (new)
- `mem://constraints/itinerary/ledger-check-mutation-only.md` (append bullet)

## Out of scope

- Mutating saves (chat actions, manual edits, refresh-day, generation pipeline) — the fingerprint gate is opt-in via `skipLedgerCheck`.
- Fixing the empty-day false-positive detector itself — the no-op gate makes it harmless either way; tightening the detector is a separate task if symptoms persist.