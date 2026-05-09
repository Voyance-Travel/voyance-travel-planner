## Fix 2.3: Idempotency keys on Stripe checkout creation

### Current state (verified)
Already pass `idempotencyKey`:
- `create-checkout/index.ts:151` — `checkout:${userId}:${priceId}:${mode}:${days}:${returnPath}`
- `add-credits/index.ts:108` — `credit_topup:${userId}:${amount_cents}:${minuteBucket}`
- `purchase-trip-pass/index.ts:127` — `trip_pass:${userId}:${trip_id}`

Missing `idempotencyKey` (the actual gaps):
- `create-embedded-checkout/index.ts:142` — same shape as `create-checkout` but no key passed
- `create-booking-checkout/index.ts:234` — booking checkout, no key
- `book-activity/index.ts:120` — per-item booking, no key
- `purchase-smart-finish` — N/A (deleted in Fix 2.1)

### Changes

**1. `create-embedded-checkout/index.ts`** (line 142–150)
Add a deterministic key built the same way as `create-checkout` (which already handles the equivalent flows). Insert before the call:
```ts
const idempotencyKey = `embedded:${userId}:${priceId}:${mode}:${groupTripId ?? ''}:${returnPath ?? ''}`.slice(0, 255);
```
and pass `{ idempotencyKey }` as the second arg to `stripe.checkout.sessions.create(...)`.

**2. `create-booking-checkout/index.ts`** (line 234)
Trip-scoped key — one outstanding booking checkout per trip + total amount. Use a 60-second bucket so a deliberate retry after a minute can still create a fresh session if the user genuinely retries (matches `add-credits` pattern, avoids permanent lock-out if first session expires unpaid):
```ts
const totalCents = (flightCents | 0) + (hotelCents | 0) + (activitiesCents | 0);
const minuteBucket = Math.floor(Date.now() / 60000);
const idempotencyKey = `booking:${userId}:${tripId}:${totalCents}:${minuteBucket}`.slice(0, 255);
```
Pass `{ idempotencyKey }` to the create call.

**3. `book-activity/index.ts`** (line 120)
Per-item key — one outstanding session per (user, trip, item, amount), 60-second bucket:
```ts
const minuteBucket = Math.floor(Date.now() / 60000);
const idempotencyKey = `book_activity:${user.id}:${tripId}:${itemId}:${amountCents}:${minuteBucket}`.slice(0, 255);
```
Pass `{ idempotencyKey }` to the create call.

### Notes
- All keys stay under Stripe's 255-char limit via `.slice(0, 255)`.
- Minute-bucket strategy on booking flows (vs the permanent key used for `purchase-trip-pass`) is deliberate: a one-shot trip-pass must never duplicate, but bookings need to allow a second attempt after the cancellation window without manual cleanup.
- No frontend changes; no DB changes; no new functions.

### Validation
- Spot-check each function's logs after a single invocation: confirm a `sessionId` is returned and the existing `logStep("Checkout session created", ...)` line still fires.
- Manual: double-click each "Pay" / "Book" button in preview within 1s; only one Stripe session should appear in the dashboard.
