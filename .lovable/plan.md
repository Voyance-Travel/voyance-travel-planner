## Fix R3.4 — Unhardcode currency in `create-booking-checkout`

`create-booking-checkout/index.ts:197-227` hardcodes `currency: 'usd'` on every `price_data` line item. If the trip is priced in another currency, Stripe still charges USD while the UI shows e.g. EUR — silent mismatch.

### What I verified

- `public.trips` has **`budget_currency`** (not `currency`).
- `public.trip_payments` has **`currency`**.
- Line 34 hardcodes `SINGLE_TRIP_PRICE_ID = 'price_1RpYXMFYxIg9jcJUxDiyEFp5'` — a fixed Stripe Price object whose currency is set in Stripe (USD). **Stripe Checkout requires every line item in the same currency**, so we can only honor a non-USD trip currency by either (a) replacing the fixed Price with `price_data` for the service fee too, or (b) keeping USD-only checkout and rejecting non-USD trips with a clear error. The plan below picks (a) so non-USD bookings actually work, with the service-fee USD amount converted/passed via `price_data`.

### Changes

**File: `supabase/functions/create-booking-checkout/index.ts`**

1. Add an allowlist of Stripe-supported currencies to validate against:
   ```ts
   const SUPPORTED = new Set(['usd','eur','gbp','cad','aud','chf','jpy','sek','nok','dkk','nzd']);
   ```

2. Resolve trip currency right after the trip is loaded (around line 124):
   ```ts
   const tripCurrency = String(trip.budget_currency || 'usd').toLowerCase();
   if (!SUPPORTED.has(tripCurrency)) {
     return new Response(JSON.stringify({
       error: `Unsupported currency: ${tripCurrency}. Please change your trip currency.`,
       code: 'UNSUPPORTED_CURRENCY',
     }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
   }
   ```

3. **Service-fee line item** — switch from the fixed Price ID to `price_data` so it inherits `tripCurrency`. Move the USD service-fee amount into a constant and use it as `unit_amount` (Stripe still treats the value as the trip currency's minor units; document the simplification — exact FX is out of scope for this fix):
   ```ts
   const SERVICE_FEE_CENTS = 2999; // $29.99 service fee, charged in trip currency
   lineItems.push({
     price_data: {
       currency: tripCurrency,
       product_data: { name: 'Voyance Trip Service Fee' },
       unit_amount: SERVICE_FEE_CENTS,
     },
     quantity: 1,
   });
   ```
   `SINGLE_TRIP_PRICE_ID` and its constant become dead — remove the constant.

4. Replace each `currency: 'usd'` on lines 200, 211, 222 with `currency: tripCurrency`.

5. **Mismatch validator** — when activities total comes from a Viator quote, compare its currency to `tripCurrency`. The activities total currently arrives as a number from the client; extend it (and the body Zod-style guard at lines 44-49) to also accept an optional `activitiesCurrency`, and log + reject when it differs from the trip currency:
   ```ts
   const activitiesCurrency = typeof body?.activitiesCurrency === 'string'
     ? body.activitiesCurrency.toLowerCase() : tripCurrency;
   if (activitiesCents > 0 && activitiesCurrency !== tripCurrency) {
     logStep('CURRENCY_MISMATCH activities', { activitiesCurrency, tripCurrency });
     return new Response(JSON.stringify({
       error: `Activity prices are quoted in ${activitiesCurrency.toUpperCase()} but trip currency is ${tripCurrency.toUpperCase()}. Refresh and retry.`,
       code: 'CURRENCY_MISMATCH',
     }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
   }
   ```
   (Same pattern can be applied opportunistically to flight/hotel selections by reading their stored `currency` field if present — done as a soft `logStep` warning, not a hard reject, since legacy selections may not carry currency.)

6. Stamp `currency: tripCurrency` into the metadata + into the `trip_payments` insert downstream so reporting stays consistent (verify the insert path lines 260+ — already passes `currency` from somewhere; if currently hardcoded to USD there too, swap to `tripCurrency`).

### Out of scope

- Real FX conversion of the $29.99 service fee — we charge `2999` minor units in whatever currency the trip uses (i.e. €29.99, £29.99). If you want true FX, that's a follow-up with a rate source.
- Converting the Stripe Price `SINGLE_TRIP_PRICE_ID` to a multi-currency Price object — `price_data` route is simpler and avoids a Stripe-side migration.
- Reconciling Viator's supplier-native currency to the trip currency (just rejecting on mismatch for now).
- `verify-booking-payment` / `stripe-webhook` currency handling — they already read from the session, but worth a follow-up sweep.

### Verification

1. EUR trip → checkout opens with all four line items in EUR; total in Stripe matches UI.
2. GBP trip with no flight/hotel → just the service-fee line, in GBP.
3. Trip with `budget_currency = 'xyz'` → 400 `UNSUPPORTED_CURRENCY`.
4. EUR trip + client posts `activitiesCurrency: 'usd'` with `activitiesTotal > 0` → 400 `CURRENCY_MISMATCH`, log emitted.
5. USD trip (default) → behavior unchanged from today.
6. `trip_payments` row carries the trip's currency, not USD.
