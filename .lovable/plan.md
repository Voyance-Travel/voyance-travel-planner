The issue is still real: the previous fix only covered some backend paths. The frontend still builds `userAnchors` from chat `perDayActivities` without filtering vague items, and the backend Day Brief still treats every existing `lockedActivities` row as a hard anchor even if it has no time/venue/purpose.

Plan:

1. Frontend anchor creation
- Update `src/utils/userAnchors.ts` so `buildUserAnchors()` only returns true hard anchors.
- Hard anchor = explicit time OR real named venue.
- Soft wish = vague request like `sushi lunch`, `spa`, `nice dinner`, `do flight and hotel`; these stay in metadata/request context, but do not become `userAnchors`.
- Add frontend regression tests so chat-planner `perDayActivities` no longer create locked anchors for vague untimed requests.

2. Backend prompt lock phase
- Tighten `parseUserActivities()` in `compile-prompt.ts` so *any* no-time/no-venue entry becomes a `USER WISH`, not only entries matching the current narrow vague regex.
- Keep timed events and named venues locked.
- This prevents generic text from falling through to the old “MANDATORY — DO NOT CHANGE” block.

3. Day Brief hard-vs-soft split
- In `compile-prompt.ts`, filter `ledgerAnchors` before `buildDayLedger()`.
- Locked rows with no start time and no venue/location should be demoted into `extraIntents` as soft `should`, not listed as `User locked this — DO NOT replace`.
- Timed or venue-backed locked rows remain hard locks.

4. Anchor guard restoration
- Extend `anchor-guard.ts` to treat `location.name` / `venue_name` / `venueName` consistently when deciding whether an anchor is real enough to restore.
- Never restore no-time/no-venue anchors as visible blank cards.

5. Regression coverage
- Add/extend tests for:
  - `Day 2: sushi lunch` is a soft wish, not a locked card.
  - `Day 2: do flight and hotel` does not become a blank locked activity.
  - `Dinner at Roscioli 7:30 PM` remains locked.
  - Existing stale locked activity with no time/venue is demoted to soft intent in Day Brief.

Expected result:
- Vague requested activities are incorporated into the generated day with a real venue, schedule slot, description, and purpose.
- They are no longer thrown on top as locked blank cards.
- Actual reservations, timed commitments, and named venues remain protected.