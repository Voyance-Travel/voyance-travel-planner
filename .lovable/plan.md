## Plan

1. **Patch the read-time bookend guard**
   - Update `ensureHotelReturnBookend` so a terminal hotel-property nightcap does **not** count as an already-terminal accommodation card just because it is categorized as `accommodation` or names a hotel brand.
   - Treat accommodation as terminal only when it is a true stay/checkout/return/check-in style card, not when the title/category/content indicates `nightcap`, `cocktail`, `bar`, `lounge`, or drinks.

2. **Mirror the same rule in backend generation**
   - Update `runStep8` in the itinerary quality pass so generated/persisted plans also append a return after “Four Seasons property nightcap”-style tails.
   - Keep existing protections for real checkout, stay, airport transfer, and departure-day logic.

3. **Add regression coverage**
   - Add frontend tests for: `Nightcap at Four Seasons Bar/Lounge` ending the day should append `Return to Four Seasons Hotel Osaka`.
   - Add/update backend tests around `runStep8` for the same pattern so the issue doesn’t reappear in persisted generation.

4. **Validate targeted behavior**
   - Run the focused hotel-return tests only.
   - Confirm normal terminal hotel cards remain idempotent and departure days still skip return injection.