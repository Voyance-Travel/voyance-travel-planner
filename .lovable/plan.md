## Fix 2.4: Require idempotency key for high-value spend-credits

### Current state (verified)
- **Server already enforces it.** `supabase/functions/spend-credits/index.ts:555-563` rejects with HTTP 400 + `MISSING_IDEMPOTENCY_KEY` whenever `action ∈ {trip_generation, smart_finish, hotel_optimization, regenerate_trip}` and `metadata.idempotencyKey` is missing.
- **`pending_credit_charges` insert at line 593-605 is gated by the same action set** — so the "high-value path" check the user describes already maps 1:1.
- **Frontend gaps that will break under this rule** (audited via `rg`):
  1. `src/components/itinerary/SmartFinishBanner.tsx:314-318` — retry SMART_FINISH, no key
  2. `src/components/itinerary/SmartFinishBanner.tsx:356-360` — purchase SMART_FINISH, no key
  3. `src/components/trip/TripConfirmationBanner.tsx:211-214` — HOTEL_OPTIMIZATION, no key
  4. `src/components/itinerary/EditorialItinerary.tsx:4167-4172` — REGENERATE_TRIP, no key
- **Already passing keys** (no change): `useGenerationGate.ts:221`, `ItineraryGenerator.tsx:651`, `useUnlockDay.ts:86-92`.
- **`src/services/iapService.ts`** — never calls `spend-credits` (it's a Capacitor / iOS link-out helper). No work needed.

### Changes (frontend only)

**1. `SmartFinishBanner.tsx`**
At top of `handleRetryEnrichment` and `handlePurchase`, generate one stable key per flow attempt and pass it via `metadata`:
```ts
const idempotencyKey = `smart_finish:${tripId}:${Date.now()}`;
await spendCredits.mutateAsync({
  action: 'SMART_FINISH', tripId,
  metadata: { source: 'smart_finish_banner', idempotencyKey },
});
```
Use a separate `Date.now()` per click so a deliberate retry after a failure can re-charge (matches existing `unlock_day_..._${Date.now()}` pattern in `useUnlockDay.ts`). The user's "stable retry-safe key" guidance — for SMART_FINISH the retry path is invoked explicitly via `handleRetryEnrichment` which already runs after a refund, so a fresh key per click is correct.

**2. `TripConfirmationBanner.tsx:211`**
```ts
await spendCredits.mutateAsync({
  action: 'HOTEL_OPTIMIZATION', tripId,
  metadata: { idempotencyKey: `hotel_optimization:${tripId}:${Date.now()}` },
});
```

**3. `EditorialItinerary.tsx:4167`**
Extend the existing metadata object:
```ts
metadata: {
  dayCount: totalDays,
  idempotencyKey: `regenerate_trip:${tripId}:${totalDays}:${Date.now()}`,
},
```

### Out of scope
- No server changes — `spend-credits/index.ts` already implements the gate exactly as described.
- No edits to low-value action callers (add_activity, swap_activity, etc.) — they remain optional per spec.
- No changes to `useSpendCredits.ts` plumbing — it already forwards `metadata` verbatim.
- `iapService.ts` audit closed: not a `spend-credits` caller.

### Validation
- Trigger Smart Finish purchase → confirm successful charge + no 400 in console.
- Trigger Smart Finish twice rapidly via double-click → second call returns the cached idempotent hit (look for `[spend-credits] Idempotent hit` server log) and balance only drops once.
- Trigger Hotel Optimization confirmation → same.
- Trigger trip regeneration → same.
- `rg "action: 'SMART_FINISH'|'HOTEL_OPTIMIZATION'|'REGENERATE_TRIP'|'TRIP_GENERATION'" src` and confirm every match has an `idempotencyKey` in the same `metadata`.
