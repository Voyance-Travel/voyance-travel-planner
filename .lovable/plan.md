## DC.3 — Strip booking handler from `supabase/functions/hotels/index.ts`

File is 1219 lines. Booking-mode code is concentrated and easy to excise cleanly. Below are the exact ranges and the call-site fallout to flag.

### What to delete

1. **Booking block in dispatcher** — lines **1099–1129**
   The `if (body.action === 'book') { … }` branch inside `serve()`, including the inline `createClient` + auth guard + `bookHotel(body, user.id)` call.

2. **Booking helpers** — lines **763–1043** (continuous block)
   - `interface HotelBookingRequest` (764–787)
   - `interface HotelBookingResponse` (789–800)
   - `async function bookHotel(...)` (802–983) — covers payment lookup, `payment.status !== 'paid'` guard (829), `getAmadeusToken()` call (842), Amadeus POST + sandbox simulation (885–946), success path (948–982)
   - `async function updateTripHotelConfirmation(...)` (985–1043) — only used by `bookHotel`
   - Section banner comment at 763

3. **Stale Amadeus comment refs** — touch up so verify command passes cleanly:
   - Line 311 banner: `(removed Amadeus-specific normalizeHotelData)` → keep file note neutral (`FIELD NORMALIZATION`)
   - Line 409 inline comment: `(replaces Amadeus)` → drop the parenthetical

### What stays (verified untouched)

- All search code paths (`searchHotels`, `searchHotelsByName`, `enrichHotelByName`, photo caching, currency resolution, server-side dedup cache).
- Dispatcher branches: default search (1156–1204), `searchByName` (1132–1143), `enrich` (1146–1154).
- `createClient` import at line 2 (still used by `getSupabaseAdmin` at line 28).

### Verification (post-edit)

```bash
ls supabase/functions/hotels/index.ts                              # exists
grep -c "payment.status\|paymentId" supabase/functions/hotels/index.ts   # 0
grep -c "Amadeus\|amadeus" supabase/functions/hotels/index.ts            # 0
grep -n "body.action" supabase/functions/hotels/index.ts                 # only searchByName, enrich
wc -l supabase/functions/hotels/index.ts                                 # ~935 lines
```

### Caller fallout (out of scope for DC.3, flagged)

`src/services/hotelBookingAPI.ts` will have two now-dead exports calling `action: 'book'`:
- `createHotelBooking` (line ~104, invokes at line 112)
- A second invoke at line 362 inside `checkHotelAvailability` is `action: 'search'` — that one stays valid.

`createHotelBooking` will return a 400 from the edge function (no matching branch falls through to default search, which will reject the booking-shaped body). Recommend a follow-up DC item to delete `createHotelBooking` + its UI callers, mirroring DC.1/DC.2 for flights.

### Edge function deploy

After the edit, redeploy via `supabase--deploy_edge_functions` with `["hotels"]` so the live function drops the booking surface.