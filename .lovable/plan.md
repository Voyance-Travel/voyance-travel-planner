## DC.5 — Strip hotel + flight line items from `create-booking-checkout`

File: `supabase/functions/create-booking-checkout/index.ts` (413 lines). Hotel and flight booking are both dead after DC.1–DC.4. Activities + service fee are the only live charge surfaces.

### Edits (top-to-bottom)

**1. Body parsing — lines 47–48**
Drop both `flightTotal` and `hotelTotal` reads.

**2. logStep — line 51**
Remove `flightTotal`, `hotelTotal` from the `"Request body"` payload.

**3. Bounds check — line 58**
Reduce to:
```ts
if (activitiesTotal < 0 || activitiesTotal > 1000000) { … }
```

**4. Server-derived selection prices — lines 148–160**
Delete `serverFlightTotal` and `serverHotelTotal` blocks (the `trip.flight_selection` / `trip.hotel_selection` price reads).

**5. Cents conversion + price-mismatch guards — lines 163–184**
Delete `clientFlightCents`, `clientHotelCents`, `serverFlightCents`, `serverHotelCents`, both PRICE_MISMATCH return branches, and fallback `flightCents` / `hotelCents`. Keep only:
```ts
const activitiesCents = Math.round((activitiesTotal || 0) * 100);
```

**6. Currency-mismatch soft warns — lines 196–204**
Delete both `flightSelCurrency` and `hotelSelCurrency` blocks.

**7. Line items — lines 236–256**
Delete both `if (flightCents > 0)` and `if (hotelCents > 0)` `lineItems.push(...)`. Keep service fee (227–234) and activities (258–267).

**8. Idempotency total — line 275**
```ts
const totalCents = (activitiesCents | 0);
```

**9. trip_payments inserts — lines 316–348**
Delete the `flightCents > 0` and `hotelCents > 0` paymentRecords pushes. Keep the activities push.

### What stays

- Auth, trip lookup, `tripCurrency` / `activitiesCurrency` resolution.
- `SERVICE_FEE_CENTS` line item (always required).
- Activities currency-mismatch hard reject (lines 187–194).
- `activitiesCents` line item, `activity` paymentRecord, Stripe session create + idempotency, trip status / booking_reference update.

### Verification

```bash
grep -c "hotelTotal\|hotelCents\|Hotel Booking" supabase/functions/create-booking-checkout/index.ts   # 0
grep -c "flightTotal\|flightCents\|Flight Booking" supabase/functions/create-booking-checkout/index.ts # 0
grep -c "flight_selection\|hotel_selection" supabase/functions/create-booking-checkout/index.ts        # 0
```

### Caller note (out of scope)

Frontend may still POST `flightTotal` / `hotelTotal`; they will be silently ignored after this change. Flag for follow-up caller cleanup.

### Deploy

Redeploy `create-booking-checkout` after edits.