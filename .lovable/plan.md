
Goal: make invite links deterministic so you always know the copied link is valid for the currently open trip, and give you a one-click reset when you want a guaranteed fresh token.

What is happening today (confirmed)
1. A new invite token is generated only when:
   - no invite row exists for that trip, or
   - the invite is expired and gets refreshed.
2. Re-copying the link does not generate a new token.
3. The itinerary page caches `shareLink` in component state and does not reset it on trip change.
4. There are multiple share entry points with inconsistent behavior (`travelers - 1` vs `10` max uses).
5. Your screenshot message (“Failed to accept invite. Please try again.”) is the generic catch path, so the real backend failure reason is hidden.

This explains why “we thought it was fixed” keeps happening: the app can keep serving an old/wrong cached link and then hides the real join failure reason.

Implementation approach

Phase 1 — Guarantee “copy” always resolves the current trip’s active invite
- Replace “copy cached string” behavior with “resolve current invite before copy”.
- In the main itinerary share flow (`EditorialItinerary.tsx`):
  - always fetch/resolve invite for current `tripId` on copy/generate click,
  - never trust previously cached `shareLink` as source of truth.
- Reset local share state whenever `tripId` changes:
  - clear `shareLink`,
  - clear copied state.
- Do the same in other share surfaces:
  - `TripShareModal.tsx` (internal state currently initialized once and can go stale),
  - `ShareTripCard.tsx` (current effect can retain previous trip link when trip changes).

Phase 2 — Centralize invite resolution in one backend-backed helper
- Add a shared invite resolver service used by all UI share entry points.
- Service behavior:
  - resolve existing invite for this trip/owner,
  - refresh if expired/exhausted,
  - align max uses with current trip capacity rule,
  - return structured link health info (token, expiry, uses, spots remaining, reason).
- All components use this one helper so behavior is identical everywhere.

Phase 3 — Add explicit link health + reset controls (so you can trust what you send)
- In share UI, show:
  - “Verified just now”
  - spots remaining
  - uses (`x / y`)
  - expiry time
- Add “Reset link” button:
  - force-rotate token,
  - copy fresh link immediately,
  - old token becomes invalid by design.
- If trip is full, block copying and show full-trip message instead of silently handing out a dead link.

Phase 4 — Make failures diagnosable (no more blind generic errors)
- Update invite accept flow to surface structured reasons from backend:
  - `trip_full`, `expired`, `invite_limit_reached`, `already_member`, etc.
- On accept failure, display specific user-facing message (not generic “invalid”).
- Add lightweight backend audit event for invite accept failures (token hash + reason + trip id) so issues are detectable even if users don’t report them.

Technical scope

Frontend files
- `src/components/itinerary/EditorialItinerary.tsx`
  - reset share state on `tripId` change,
  - copy button always resolves current invite first,
  - add reset-link action and health display.
- `src/components/sharing/TripShareModal.tsx`
  - re-sync/reset internal link state on `tripId` changes,
  - route all link creation through shared resolver.
- `src/components/post-trip/ShareTripCard.tsx`
  - prevent stale `shareUrl` reuse across trip changes,
  - use shared resolver.
- `src/pages/AcceptInvite.tsx`
  - map backend reason codes to precise error UI.

Backend (Lovable Cloud database functions)
- extend invite info/accept responses to include reason/status fields.
- add one canonical “resolve or rotate invite” function for trip owners.
- no auth model changes needed; this stays owner-controlled.

How you’ll know it’s fixed going forward
- Every time you press copy, the app verifies/resolves against current trip first.
- Share panel visibly reports invite health before sharing.
- You have a manual “Reset link” control for immediate forced rotation.
- Failures are logged with reason codes so we can diagnose without asking users to retry 15 times.

Validation checklist
1. Open Trip A, copy link; open Trip B, copy link; confirm tokens differ and each maps to correct trip.
2. Re-open share panel after trip switch; ensure no prior link is shown/copied.
3. Join with multiple accounts up to capacity; link remains valid until full.
4. Press “Reset link”; old link fails, new link succeeds.
5. Force each failure mode (full, expired, already member) and confirm clear message on invite page.
