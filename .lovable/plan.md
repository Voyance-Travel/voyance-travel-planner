### Problem
`viator-book/index.ts` writes Viator confirmation only to `trip_payments.metadata`. `VoucherModal` reads from the activity row (`activity.voucherUrl`, `voucherData`, `confirmationNumber`, `vendorName`, `vendorBookingId`, `cancellationPolicy`, `bookedAt`), so vouchers never appear in the UI.

### Schema verified
`public.trip_activities` already has: `voucher_url text`, `voucher_data jsonb`, `confirmation_number text`, `vendor_name text`, `vendor_booking_id text`, `cancellation_policy jsonb`, `booked_at timestamptz`, `external_booking_id text`. **No migration needed.**

### Change — `supabase/functions/viator-book/index.ts`
After the existing `trip_payments` update (line ~284) and **before** the `transition_booking_state` RPC call (line 287), insert a direct update to `trip_activities`:

```ts
await serviceSupabase
  .from('trip_activities')
  .update({
    voucher_url: data.voucher?.url ?? null,
    voucher_data: viatorConfirmation,
    confirmation_number: data.viatorRef || data.bookingRef || null,
    external_booking_id: data.bookingRef || null,
    vendor_name: 'Viator',
    vendor_booking_id: data.viatorRef || data.bookingRef || null,
    cancellation_policy: data.cancellationPolicy ?? null,
    booked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq('id', activityId);
```

Order matters: write voucher fields first so any client refetch triggered by the state-transition signal sees the populated row.

### Out of scope
- No schema migration (columns already exist).
- No changes to `transition_booking_state` RPC — it continues to manage `booking_state` + `state_history`.
- No changes to the failure path; refund logic stays as-is.
- `VoucherModal` already maps these columns via the activity-loader; no UI change.

### Verification
After a successful Viator booking:
1. `trip_activities` row for `activityId` shows `voucher_url`, `voucher_data`, `confirmation_number`, `vendor_booking_id`, `booked_at` populated.
2. Opening `VoucherModal` shows confirmation number, Download Voucher button, and cancellation policy without a manual refresh.
3. Idempotency: repeat call overwrites with identical values (no constraint violation).
