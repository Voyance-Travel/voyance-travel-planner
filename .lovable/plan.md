## RS.M.I1 — Explicit hotel-change instruction in `dayConstraints`

### Context

`supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` already contains rich hotel-change guidance, but it lives only inside the middle-day branch (around line 758, gated on `flightContext.hotelName`). The first-day and last-day branches (lines 636–663) build `timingInstructions` from the bare `dayConstraints` and never see any hotel-change directive. RS.M.I1 wants a single explicit hotel-change note that flows into every branch.

The cleanest place to inject it is right after `dayConstraints` is read from the schema (line 629), so all three branches (first / last / middle day) inherit the same explicit sequence.

### Change

**File:** `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

At line 629, augment `dayConstraints`:

```ts
const baseDayConstraints = schema.dayConstraints;

// RS.M.I1: explicit hotel-change directive — applies to every day branch
// (first / last / middle) so the model always sees the required sequence.
const hotelChangeNote = facts.resolvedIsHotelChange
  ? `\n\n=== HOTEL CHANGE DAY ===\nYou are switching hotels today. Schedule:\n` +
    `- Checkout from ${facts.resolvedPreviousHotelName || 'previous hotel'} (typically 11:00)\n` +
    `- Travel to ${resolvedHotelOverride?.name || flightContext.hotelName || 'new hotel'} ` +
      `(~30-45 min depending on distance)\n` +
    `- Check-in at new hotel (typically 15:00)\n` +
    `- Plan flexible activities BEFORE checkout and AFTER check-in. ` +
      `No tight reservations during the gap.\n`
  : '';

const dayConstraints = `${baseDayConstraints}${hotelChangeNote}`;
```

### Notes

- `facts.resolvedIsHotelChange` / `facts.resolvedPreviousHotelName` are already read elsewhere in the file via the `facts.` namespace; no destructure change needed.
- This is additive — when `resolvedIsHotelChange` is false, `dayConstraints` is unchanged byte-for-byte.
- The existing detailed mid-day block at line 758 stays as-is; the new note is a concise top-level summary that also reaches first/last day prompts.

### Verify

```bash
grep -c "HOTEL CHANGE DAY\|resolvedIsHotelChange" \
  supabase/functions/generate-itinerary/pipeline/compile-prompt.ts
```
Expect ≥ 2 (will increase by 2: the new `=== HOTEL CHANGE DAY ===` literal plus the new `facts.resolvedIsHotelChange` reference).
