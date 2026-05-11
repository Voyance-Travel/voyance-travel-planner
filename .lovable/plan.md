# Q43 + M1 + M2 — Approved with notes

## Part 1 — Q43: SECURITY DEFINER audit + watch-list remediation

### 1a. Document the architectural decision

Append an "Accepted findings" section to `@security-memory` covering:

- The 30 authenticated `SECURITY DEFINER` functions are the project's intentional RPC contract for RLS-bypassing privileged operations (invites, credit deduction, group budgets, share toggles, booking state machine).
- Future linter/scanner runs that re-flag these as a class should treat them as accepted unless the function:
  - Is callable by `anon` AND touches PII or secrets, OR
  - Reads from `auth.users` AND lacks both an `auth.uid() IS NOT NULL` guard and a per-caller scope filter, OR
  - Performs writes scoped only by a client-supplied id (no `auth.uid()` check or membership join).
- Individual finding entries will still be triaged; the **class** is approved.

### 1b. Watch-list remediation (the 4 functions)

Codebase grep confirms **zero callers** for `get_user_id_by_email`, `get_user_info_by_email`, and `get_intake_account` across `src/`, `supabase/functions/`, and SQL migrations.

Treat dead code as the cheapest fix: **drop them.**

| Function | Action | Rationale |
|---|---|---|
| `get_user_id_by_email` | `DROP FUNCTION` | No callers. PII enumeration risk. `auth.uid() IS NOT NULL` insufficient against authed enumeration at scale. If invite-by-email returns, build it on `send-invite-email` edge fn that emails the recipient without confirming registration status to the caller. |
| `get_user_info_by_email` | `DROP FUNCTION` | Same as above; returns even more PII (display_name, handle, names). |
| `get_intake_account` | Keep, **REVOKE FROM `anon, authenticated`; GRANT TO `service_role` only** | Returns minimal data (id, name) gated on `intake_token` which is itself a secret. Currently has no role guard so anyone with a token can call it. Restrict to service_role and route via an edge function that validates the token server-side. No callers in repo today, so no client breakage. |
| Plus: write a one-shot reverse-callers check via Supabase logs before drop | Defensive | If anything in production hits the dropped functions in the next 7 days, logs will surface it. |

**Migration:** single SQL migration file dropping the two functions and revoking grants on the third. Add a comment block citing the security-memory accepted-findings entry and the date.

**Memory:** add a new entry `mem://constraints/security/security-definer-accepted-class` documenting the accepted-class decision and the three watch-list fixes for traceability.

### 1c. Note for future-me

If invite-by-email UX is rebuilt later, the right shape is:
- Client POSTs `{recipient_email, trip_id}` to an edge function
- Edge function never returns whether the email is registered
- Email is always sent (existing user → magic link, new user → signup invite)
- Eliminates the enumeration vector entirely

## Part 2 — M1: Phantom event scrubber test addition

The scrubber and 3-layer defense already shipped (`mem://constraints/itinerary/schedule-coherent-copy`). Add the explicit Madrid regression test the user called out.

In `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts` (or the existing scrub-activity test file, whichever owns `scrubPhantomEventRefs`), add:

```ts
it('drops "Leave by 20:30 for tonight\'s Michelin-starred dinner" when no dinner card exists', () => {
  const description = "Wander the gallery rooms. Leave by 20:30 for tonight's Michelin-starred dinner.";
  const out = scrubPhantomEventRefs(description, { hasDinner: false });
  expect(out).toBe('Wander the gallery rooms.');
  expect(out).not.toMatch(/20:30|Michelin|tonight/i);
});

it('preserves the same sentence when a dinner card IS present (not phantom)', () => {
  const description = "Wander the gallery rooms. Leave by 20:30 for tonight's Michelin-starred dinner.";
  const out = scrubPhantomEventRefs(description, { hasDinner: true });
  expect(out).toContain('20:30');
});
```

If the current scrubber signature doesn't take a `hasDinner` context arg, add the test against the actual API surface used at the §10b call site (whatever determines "phantom" — typically per-day activity-list inspection).

No production code changes.

## Part 3 — M2: Departure-day combined regression test

The enforcement already shipped (`mem://constraints/itinerary/departure-day-final-enforcement`). Add the combined Madrid scenario test.

In `supabase/functions/generate-itinerary/__tests__/` add `m2-departure-day-combined.test.ts`:

```ts
// Madrid combined failure: 21:05 checkout + untimed transfer + 22:10–00:25 dinner
// All three must be fixed by enforceDepartureDayLogistics in one pass.

it('M2 combined: late checkout + untimed transfer + post-transfer dinner all repaired', async () => {
  const day = {
    dayNumber: 5,
    activities: [
      { id: 'breakfast', startTime: '08:30', endTime: '09:30', category: 'food', name: 'Breakfast at hotel' },
      { id: 'museum',    startTime: '10:00', endTime: '12:30', category: 'culture', name: 'Prado' },
      { id: 'lunch',     startTime: '13:00', endTime: '14:30', category: 'food', name: 'Lunch' },
      { id: 'checkout',  startTime: '21:05', endTime: '21:20', category: 'logistics', subcategory: 'checkout', name: 'Hotel checkout' },
      { id: 'transfer',  startTime: '',      endTime: '',      category: 'logistics', subcategory: 'transfer_airport', name: 'Transfer to Airport' },
      { id: 'dinner',    startTime: '22:10', endTime: '00:25', category: 'food', name: 'Dinner' },
    ],
  };
  const flight = { departureTime: '23:55', kind: 'international' }; // buffer 180m → transfer ends 20:55

  const out = enforceDepartureDayLogistics(day, { flight, transferMinutes: 30, isLastDay: true });

  // Checkout retimed ≤ min(11:00, 20:55−30−60−30 = 19:55) → 11:00
  const checkout = out.activities.find(a => a.id === 'checkout');
  expect(parseTimeToMinutes(checkout.startTime)).toBeLessThanOrEqual(parseTimeToMinutes('11:00'));

  // Transfer ends at dep − buffer = 20:55
  const transfer = out.activities.find(a => a.id === 'transfer');
  expect(transfer.endTime).toBe('20:55');
  expect(transfer.startTime).toBe('20:25'); // 20:55 − 30m

  // Dinner removed (non-logistics after transfer start)
  expect(out.activities.find(a => a.id === 'dinner')).toBeUndefined();

  // Locked rows would be preserved — verify exemption holds
  // (assert in a separate test by adding isLocked:true to the dinner)
});

it('M2 combined: locked dinner is preserved even when it falls after transfer', () => {
  // ... same setup but dinner.isLocked = true → expect dinner still present, transfer/checkout still fixed
});
```

No production code changes — this is purely a regression assertion against existing behavior.

## Files touched

- New: `supabase/migrations/<timestamp>_drop_email_lookup_functions_and_lock_intake.sql`
- New: `mem://constraints/security/security-definer-accepted-class` (memory file)
- Update: `mem://index.md` (add new memory reference)
- Update: `@security-memory` via `security--update_memory` (Accepted findings section)
- Update: existing `prompt-leak-scrub.test.ts` (or scrub-activity test) — 2 new test cases
- New: `supabase/functions/generate-itinerary/__tests__/m2-departure-day-combined.test.ts`

## Out of scope

- Rebuilding invite-by-email UX (deferred until a feature actually needs it)
- Touching any of the other 30 SECURITY DEFINER functions (class-accepted)
- M1/M2 production code changes (already shipped per memory)
- The remaining 8 prompts (A1, A2, A4, A5, B-M3, B-M4, B-M5, C1) and 4 backlog items — separate batches per the user's queue
