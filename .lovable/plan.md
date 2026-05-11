## Plan

1. **Add one final departure-day enforcement pass in `repair-day.ts`**
   - Create a deterministic helper that runs on true departure days after existing repairs/transport coherence and before the final timing cascade.
   - Compute a single checkout target capped at **11:00 AM** and constrained by the departure time, airport buffer, transfer duration, and checkout duration.
   - Retime or inject checkout at that target.
   - Retime or inject airport transfer only when a flight departure time exists.
   - For no-flight departure days, keep checkout at 11:00, do **not** synthesize an airport transfer, and remove non-logistics activities after noon.

2. **Make the airport-transfer barrier authoritative**
   - Treat `Transfer to Airport` / airport-bound transport as the hard cutoff.
   - Remove any non-logistics, non-locked activity starting at or after the transfer start, including late dinners ending after midnight.
   - Preserve locked/manual/user-edited activities per the Universal Locking rule.

3. **Fix existing drift points rather than layering contradictory behavior**
   - Align existing §8/§8b logic with the helper so transfer timing uses `departure - buffer - transferMinutes` instead of ending too early or floating untimed.
   - Ensure the final transport realignment pass does not rewrite the airport transfer into a normal neighbor-to-neighbor venue transport.
   - Keep save-time post-checkout pruning as a safety net, but rely on repair-day as the primary source of correct generated output.

4. **Add regression coverage**
   - Extend `m2-departure-day-logistics.test.ts` for:
     - 13:30 flight: checkout around 09:15–10:00 depending on transfer duration; airport transfer ends at required airport arrival time.
     - no flight info: checkout at/near 11:00, no airport transfer, no non-logistics activity after noon.
     - Madrid failure shape: 21:05 checkout, untimed/floating airport transfer, and late dinner are normalized/pruned.

5. **Update project memory after implementation**
   - Record the finalized departure-day logistics enforcement rule so future work preserves the behavior.