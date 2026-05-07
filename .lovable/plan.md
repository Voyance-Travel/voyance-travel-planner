## Plan: end permanently stuck payment reconciliation

### 1. Make checkout writes fail-safe
- Update the activity checkout function so once a `trip_payments` row is created, any later checkout or gateway failure immediately marks that row `failed` instead of leaving it `pending`/`processing`.
- Keep the payment record creation before the gateway call where possible, with `provider_data`/metadata storing the failure reason for debugging.
- If the local payment write fails after a Stripe session is created, cancel/expire the session or return a hard error instead of giving the user a checkout URL that cannot reconcile.

### 2. Repair full-trip booking checkout
- Fix `create-booking-checkout`’s broken checkout setup: it references `customerId` and `origin` without defining them.
- Add the same fail-safe status handling for flight/hotel/activity payment rows created for a booking checkout.
- Ensure failures after rows are inserted mark all session-linked rows as `failed`.

### 3. Harden verification and webhook reconciliation
- Update `verify-payment` and `verify-booking-payment` so non-paid terminal Stripe statuses (`unpaid`, `expired`, `canceled`, failed payment intent) update matching `trip_payments` rows to `failed`/`cancelled` instead of returning a status that leaves the UI waiting.
- Update the Stripe webhook handler to also finalize session-linked rows on completed/expired/failed events and log when no row is matched.

### 4. Add stale-pending cleanup
- Add a small backend reconciliation function or database RPC that marks old `pending`/`processing` `trip_payments` rows as `failed` after a safe TTL when they have a Stripe checkout session but were never completed.
- Call it from the Payments tab fetch path before rendering totals so old orphaned rows stop causing sticky reconciliation states.

### 5. Clean current orphaned data
- Apply a one-time data cleanup for existing stale `pending`/`processing` trip payment rows that are old enough to be impossible in-flight.
- Preserve genuinely paid/refunded/cancelled rows.

### 6. Validate the fix
- Add targeted regression coverage for stale pending rows and checkout failure handling.
- Test the affected backend functions and verify the current stale pending row no longer appears as an active pending payment.