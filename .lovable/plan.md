

# Remove Em Dashes from Founder's Guides

## What
Two em dashes (—) exist in user-facing text in `src/data/founders-guides.ts`. Both are in `summary` fields.

## Where
1. **Line 29** (London summary): `"...top 10 things — it's what I actually did..."` → replace `—` with `-`
2. **Line 384** (Atlanta summary): `"A local's guide to Atlanta — world-class dining..."` → replace `—` with `-`

## Files Changed
- **Modified**: `src/data/founders-guides.ts` — replace 2 em dashes with regular dashes

