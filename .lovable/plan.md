# R3.9 — Document the dead `changed` booking state

## Decision

Take option **(b)** from the report: keep the value, document it as reserved.

Rationale (all three matter):

- Postgres makes removing an enum value painful: there's no `DROP VALUE`. The only safe path is rename → create new enum → cast every column → drop old. For a value that costs nothing to leave, that's not a worthwhile migration.
- The state isn't truly unsafe — it appears in the type, the `VALID_TRANSITIONS` map, the RPC's allowed-transition `CASE`, the label map, the badge color map, and a `case 'changed':` branch in the state machine. All of those handle it correctly; it's just never reached.
- Future Viator/agency reschedule flows are the obvious caller — the report itself notes "reserved for future modification flow."

## Change set

A single comment edit in `src/services/bookingStateMachine.ts` immediately above the `BookingItemState` union (around line 18). Wording:

```ts
// NOTE: 'changed' is reserved for the future booking-modification flow
// (e.g. Viator/vendor reschedules, supplier-driven date or price changes).
// Currently no caller transitions into 'changed' — the state, its label,
// its badge color, and its allowed-transition row in VALID_TRANSITIONS
// (also mirrored in the SQL booking_item_state enum and the
// transition_booking_state RPC) are intentionally kept so adding the flow
// later doesn't require an enum migration. Do not delete without a plan
// for the corresponding Postgres enum-value removal.
```

No code, type, RPC, or migration changes.

## Out of scope

- Touching the SQL `booking_item_state` enum.
- Removing the `case 'changed':` branches, label, or badge color — those are part of the contract this comment is preserving.
- Any change to `transition_booking_state` (already correctly handles `changed → booked_confirmed/cancelled/refunded`).

## Verification

- Comment compiles (it's a comment).
- `rg "'changed'" src supabase/functions` still shows the same 6 references in `bookingStateMachine.ts` plus the RPC — no functional drift.

## Memory

Skip — too small and self-explanatory once the comment is in the file. The comment itself is the durable note.
