

## Fix: Another Dead Busan Unsplash URL

`photo-1596422846543-75c6fc197f11` (Busan coastal view) returns 404. This is the replacement URL that was left in the previous fix.

### Changes

1. **`src/utils/destinationImages.ts`** — Remove or empty the dead Busan URL from the curated images map. Since this is the only remaining Busan entry, set `'busan': []` so the fallback chain skips to DB/API.

2. **`src/hooks/useDestinationImages.ts`** — Add `photo-1596422846543-75c6fc197f11` to the `BLOCKED_IMAGE_IDS` set.

Two single-line edits.

