## Status: Bug #3 already shipped

The exemption requested in this bug report was implemented in the previous round (the same turn that wired `applyValidationGate` into the multi-day path). Verified in [orphan-transit.ts:63-74](supabase/functions/_shared/orphan-transit.ts:63):

```ts
// Case 1: transit at end of day with no following card → orphaned.
// Exempt logistics targets (airport/station/port/etc.) — flight/train
// cards live in trip metadata, so the transfer legitimately ends the day.
if (i === activities.length - 1) {
  const titleStr = String(act?.title || '');
  const checkBlob = `${target || ''} ${titleStr}`;
  if (LOGISTICS_TARGET_RE.test(checkBlob)) continue;
  activities.splice(i, 1);
  removed++;
  console.warn(`[ORPHAN-TRANSIT] Dropped end-of-day transit: "${act.title}"`);
  continue;
}
```

`LOGISTICS_TARGET_RE` (line 23) covers: `airport | station | terminal | port | cruise terminal | ferry terminal | train station | gare | stazione | hbf | hauptbahnhof`.

Test coverage already in [orphan-transit.test.ts](supabase/functions/_shared/__tests__/orphan-transit.test.ts):
- ✅ "Transfer to JFK Airport" survives end-of-day
- ✅ "Taxi to Stazione Santa Lucia" survives end-of-day
- ✅ "Walk to Salsify at The Roundhouse" still dropped (no logistics keyword)
- ✅ Case 2 mid-day orphan drop still works

## Proposed minor hardening (optional)

The current regex only catches title-keyword logistics. A transit card whose title is non-standard but whose `transportation.kind === 'departure'` flag is set would still be dropped. Add a metadata-based fallback to the exemption:

### Change

**[supabase/functions/_shared/orphan-transit.ts](supabase/functions/_shared/orphan-transit.ts)** — extend the Case 1 exemption:

```ts
if (i === activities.length - 1) {
  const titleStr = String(act?.title || '');
  const checkBlob = `${target || ''} ${titleStr}`;
  const kind = String(act?.transportation?.kind || act?.transport?.kind || '').toLowerCase();
  const isDepartureMeta = kind === 'departure' || kind === 'airport_transfer' || kind === 'flight_transfer';
  if (LOGISTICS_TARGET_RE.test(checkBlob) || isDepartureMeta) continue;
  activities.splice(i, 1);
  removed++;
  console.warn(`[ORPHAN-TRANSIT] Dropped end-of-day transit: "${act.title}"`);
  continue;
}
```

### Test

Add one case to [orphan-transit.test.ts](supabase/functions/_shared/__tests__/orphan-transit.test.ts):

```ts
Deno.test('end-of-day transit with transportation.kind=departure survives even without keyword', () => {
  const acts = [
    { id: '1', title: 'Last lunch', category: 'dining' },
    { id: '2', title: 'Private car to flight', category: 'transport', transportation: { kind: 'departure' } },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
});
```

## Verification
- `cd supabase/functions && deno test --allow-all _shared/__tests__/orphan-transit.test.ts` — all 5 cases pass.
- `npm run typecheck` — clean.

## Recommendation

Ship the optional hardening — it's a 3-line change with one test, and it future-proofs against the rare case where the model emits a non-keyword departure title (e.g., "Private car to flight" / "Driver to gate") with proper `transportation.kind` metadata. Confirm before I proceed in build mode.
