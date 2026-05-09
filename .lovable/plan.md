## Fix 7.1 — Post-parse validation in parse-booking-confirmation

Add a validation block in `supabase/functions/parse-booking-confirmation/index.ts` immediately after the `segment_type` validation (line 336) and before the segments-array fallback (line 339).

### Validation checks
- ISO date format on `start_date`/`end_date`
- Year sanity (currentYear-1 .. currentYear+5)
- Price fields (`total_price`, `price_per_person`, `price`): numeric, ≥0, ≤1,000,000
- Trip-context window: `start_date` within `tripContext.tripDates` ±1 day slack (only when `hasTripContext`)
- `confirmation_number` required for non-`other` segment types

### Failure mode
On any error, return HTTP 422 with `{ error, details, raw: parsedBooking }` plus a `console.warn`. No persistence happens at this stage (caller persists), so an early return is sufficient.

### Verify
`grep -n "validationErrors" supabase/functions/parse-booking-confirmation/index.ts` → 5+ hits.