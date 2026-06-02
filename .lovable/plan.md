Filter known-benign informational codes (`DEPARTURE_DAY_LIGHT`, `ARRIVAL_DAY_LIGHT`) from the actionable issue set in `PersistIssuesListener.tsx` before firing a "needs regeneration" toast. These codes confirm logistics-only days and should never surface as user-actionable warnings.

**File to edit:**
- `src/components/itinerary/PersistIssuesListener.tsx`

**Change:**
Inside `showToastsFor`, after grouping issues by day and before the dedupe loop, add a filter step that drops `DEPARTURE_DAY_LIGHT` and `ARRIVAL_DAY_LIGHT` issues. If a day's remaining issues are all benign, skip the toast entirely for that day. Keep existing dedupe and severity logic unchanged.