## RS.L2 — Trip duplicate-prevention guard

### Findings
Two trip insert call sites:
- `src/services/supabase/trips.ts::createTrip` (lines 224–252) — primary path used by Setup flow.
- `src/services/voyanceAPI.ts::createTrip` (lines 180–196) — secondary path used by older flows.

Both `INSERT` directly with no dedup window. A double-click fires two requests; both succeed → two rows, two trips on the dashboard.

### Plan

Add a 30-second dedup window in **both** files immediately before the `.insert(...)`:

```ts
// Guard against double-click duplicate creation (RS.L2)
const dedupWindowIso = new Date(Date.now() - 30_000).toISOString();
const { data: recent } = await supabase
  .from('trips')
  .select('*')                     // full row so we can return a Trip without a second fetch
  .eq('user_id', userId)
  .eq('name', input.name)
  .eq('destination', input.destination)
  .eq('start_date', input.start_date)
  .gt('created_at', dedupWindowIso)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (recent) {
  console.warn('[createTrip] Duplicate request detected — returning existing trip', { tripId: recent.id });
  return transformTrip(recent as TripRow);   // voyanceAPI returns its mapped BackendTrip equivalent
}
```

Notes per file:
- `trips.ts`: re-use existing `transformTrip` mapper. `userId`/`input` already in scope.
- `voyanceAPI.ts`: build the `BackendTrip` object from `recent` using the same field mapping that already exists at lines 200+ — extract that mapper into a small local helper to avoid duplication, or inline.

### Out of scope
- DB-level UNIQUE constraint (would force schema change + handle conflict errors; client guard alone closes the double-click case which is the reported symptom).
- The 6 other call sites that wrap these two services (`createTripFromParsed`, `MysteryGetawayModal`, `ManualTripPasteEntry`, `TripForm`, `voyance.ts`, agency CRM) — they all funnel through one of the two services above, so guarding both services is sufficient.
- Button-level disabled-while-pending state (orthogonal frontend hardening; this guard works regardless).

### Verification
`grep -rc "Duplicate request detected" src/services` ≥ 2 (one per file).