## Fix #2 — Unhardcode currency in `supabase/functions/hotels/index.ts`

### Audit
`grep` confirms exactly two `currency: 'USD'` literals (no other casings):
- L503 — Google Places result mapping in `searchHotels`
- L573 — `generateFallbackHotels`

`estimateNightlyPrice` (L102) returns USD-baked numbers from a fixed `basePrices` table. Per the user's note, we'll accept that for now (Google priceLevel→USD anchor) — no conversion. We'll just stamp the trip's currency code on the result objects so downstream consumers (cost snapshot, UI) display it consistently with the rest of the trip.

### Changes (single file: `supabase/functions/hotels/index.ts`)

**1. Resolve `tripCurrency` at handler entry (after `body = await req.json()`, ~L1067).**

```ts
const SUPPORTED_CURRENCIES = new Set([
  'usd','eur','gbp','cad','aud','chf','jpy','sek','nok','dkk','nzd',
]);

let tripCurrency = String(body?.currency || '').toLowerCase();
if (!tripCurrency && body?.tripId) {
  try {
    const admin = getSupabaseAdmin();
    const { data: trip } = await admin
      .from('trips')
      .select('budget_currency')
      .eq('id', body.tripId)
      .maybeSingle();
    if (trip?.budget_currency) tripCurrency = String(trip.budget_currency).toLowerCase();
  } catch (e) {
    console.warn('[Hotels] trip currency lookup failed:', e);
  }
}
if (!tripCurrency) tripCurrency = 'usd';

if (!SUPPORTED_CURRENCIES.has(tripCurrency)) {
  return new Response(
    JSON.stringify({ error: `Unsupported currency: ${tripCurrency.toUpperCase()}`, code: 'UNSUPPORTED_CURRENCY' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Placement: inserted before the `body.action === 'book'` branch so all three branches (book / search-by-name / search / enrich) and the default search share one resolved value. (`searchHotelsByName` and `enrichHotelByName` don't currently emit a `currency` field, so they're unaffected.)

**2. Thread `tripCurrency` into the two emitters.**

- Add an optional `currency?: string` property to `HotelSearchParams` (L12) so we can pass it through `searchHotels(body)` without changing the call signature. Set `params.currency = tripCurrency` on `body` before invoking `searchHotels(body)` and `generateFallbackHotels(...)`.
- In `searchHotels`, replace L503 `currency: 'USD',` → `currency: (params.currency || 'usd').toUpperCase(),`.
- In `generateFallbackHotels`, replace L573 `currency: 'USD',` → `currency: (params.currency || 'usd').toUpperCase(),`. (Also called from L441/L540 fallback paths — same `params` object, currency already attached.)

Output stays uppercase (`'EUR'`, `'GBP'`) to match the existing wire-format the field had with `'USD'`.

**3. `estimateNightlyPrice` — out of scope for this fix.**
Per the user's note, we accept that priceLevel→USD anchor numbers are not converted. No signature change. (Future work: multiply by FX or pull priceLevel-to-local from a per-currency table.)

### Verify

```bash
grep -nE "currency: 'USD'|currency: \"USD\"" supabase/functions/hotels/index.ts
# expected: no matches
```

Plus a smoke call: POST to `/hotels` with `{ tripId, destination, checkIn, checkOut }` for a EUR trip and confirm result objects carry `currency: "EUR"`.

### Out of scope
- FX conversion of `basePrices` table.
- Currency for `searchHotelsByName` / `enrichHotelByName` (those endpoints don't surface a price/currency today).
- Migrating other edge functions still hardcoding USD (separate fixes).
