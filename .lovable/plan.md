

# Voyance Picks Batch 3: Boston + Las Vegas

## What

Insert 13 founder-curated picks into the `voyance_picks` table:

**Boston (5):**
- Boston Duck Tours — experience (priority 1)
- Boston Public Library — experience (priority 1)
- Saltie Girl — dining (priority 1)
- Eddie V's Prime Seafood — dining (priority 2)
- Yvonne's — dining (priority 2)

**Las Vegas (8):**
- Wynn Las Vegas — accommodation (priority 1)
- Encore at Wynn — accommodation (priority 1)
- The Cosmopolitan — accommodation (priority 1)
- La Cave Wine & Food Hideaway — dining (priority 1)
- Secret Pizza — dining (priority 2)
- ResortPass — experience (priority 2)
- Gordon Ramsay Fish & Chips — dining (priority 3)
- Bellagio Patisserie — dining (priority 3)

## How

Run the provided SQL INSERT as a single database migration — 13 rows, no schema changes. Then verify with:

```sql
SELECT destination, name, category FROM voyance_picks WHERE destination IN ('Boston', 'Las Vegas') ORDER BY destination, priority;
```

Data-only operation. No code changes required.

