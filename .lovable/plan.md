

## Fix: Non-UUID Activity IDs + Dead Unsplash URL

Two issues to fix:

### 1. activity_costs UUID validation
The `activity_costs` table has `activity_id` as UUID, but itinerary activities use string IDs like `"trans-jfk-midtown"`, `"arr-jfk-01"`, `"hotel-check-in-01"`, etc. When `syncActivitiesToCostTable` tries to upsert these, Postgres rejects them with `22P02`.

**Fix in `src/services/activityCostService.ts`**: Filter out non-UUID activity IDs before upserting. Add a UUID validation check (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-/i`) to skip rows with string-based IDs. This matches the edge function's existing `repair-trip-costs` logic which already skips non-UUID IDs.

### 2. Dead Busan Unsplash URL
`photo-1578037571214-25e07a2f91ef` returns 404.

**Fix in `src/utils/destinationImages.ts`**: Remove or replace the dead Busan URL, and add the photo ID to `BLOCKED_IMAGE_IDS` in `src/hooks/useDestinationImages.ts`.

### Files to edit

| File | Change |
|------|--------|
| `src/services/activityCostService.ts` | Filter non-UUID activity_ids before upsert |
| `src/utils/destinationImages.ts` | Remove dead Busan URL |
| `src/hooks/useDestinationImages.ts` | Add photo ID to blocked list |

