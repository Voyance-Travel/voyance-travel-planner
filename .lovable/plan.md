

# Confirm & Harden the Share & Manage Dialog

## What's Actually Happening

After thorough code review, the full **Share & Manage Trip** dialog is **still intact** in `EditorialItinerary.tsx`. It includes:

- **Owner display** (your name, email, avatar with crown icon)
- **TripCollaboratorsPanel** (see all members, DNA compatibility, add friends)
- **GroupBudgetDisplay** (group credit pool, top-up button)
- **Guest Permissions** (Edit Freely vs Propose & Vote toggle)
- **Invite Link** (generate/copy link)
- **Share to Social** (email, text, social media)

The screenshot you shared is from your **production site** (`travelwithvoyance.com`), which appears to be running an older deployment. The **preview** version has the full dialog working correctly. Once you publish/deploy the latest code, the full Share & Manage dialog will be back.

## Cleanup to Prevent Future Confusion

There's a separate lightweight "Share Your Trip" modal (`TripShareModal`) that only has social sharing buttons (Copy, WhatsApp, Twitter, Email). It exists as a standalone component but is **not** wired to any button on the itinerary page. To prevent any future mix-up:

### Change 1: Update ItineraryUtilityBar to use the full dialog

The `ItineraryUtilityBar` component (currently unused but exported) has its own Share button that opens the lightweight `TripShareModal`. Update it to accept an `onShareClick` callback instead, so if it's ever used, it routes to the correct full dialog.

### Change 2: Verify GroupUnlockModal Stripe wiring

Confirm the `GroupUnlockModal` (group pricing packs) correctly passes `tripId` and `tier` metadata through to the Stripe checkout flow so purchased credits land on the right trip.

---

## Technical Details

| File | Change |
|------|--------|
| `src/components/itinerary/ItineraryUtilityBar.tsx` | Replace internal `TripShareModal` with an `onShareClick` callback prop so it always delegates to the parent's full dialog |

No changes needed to `EditorialItinerary.tsx` -- the full Share & Manage dialog is already there and working. The fix is simply deploying the latest code to production.

