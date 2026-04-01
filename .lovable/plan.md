

## Apply Multi-Email Chip Input to Remaining Share Modals

The multi-email chip input was implemented in `TripShareModal.tsx`, but two other share modals still use the old single-email pattern:

### Files to update

**1. `src/components/post-trip/ShareTripCard.tsx`**
- Replace `friendEmail: string` with `friendEmails: string[]` + `emailInput: string`
- Add `addEmail`, `removeEmail`, `handleEmailKeyDown` helpers (same pattern as TripShareModal)
- Replace the single `<Input>` with the flex-wrap chip container + inline input
- Update `sendToFriend` to join all emails in the `mailto:` `to:` field
- Change label from "Send to a friend" to "Invite friends"
- Cap at 10 emails

**2. `src/components/referral/ReferralShareModal.tsx`**
- Same conversion: `friendEmail` → `friendEmails[]` + `emailInput`
- Same chip input UI pattern
- Update `sendEmail` to use `friendEmails.join(',')` in `mailto:`
- Update label and placeholder
- Cap at 10 emails

### No new dependencies
The chip input is built inline using the same pattern already in TripShareModal (flex-wrap container with badge-style dismiss chips).

| File | Change |
|---|---|
| `ShareTripCard.tsx` | Multi-email chip input, group-friendly label |
| `ReferralShareModal.tsx` | Multi-email chip input, group-friendly label |

