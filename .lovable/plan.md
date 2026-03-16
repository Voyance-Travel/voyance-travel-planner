

# Voyance Picks Batch 2: Atlanta

## What

Insert 13 founder-curated Atlanta picks into the `voyance_picks` table:

**Attractions (3):**
- Georgia Aquarium (priority 1)
- World of Coca-Cola (priority 2)
- Piedmont Park (priority 2)

**Dining (9):**
- Atlas (priority 1)
- Bacchanalia (priority 1)
- Omakase Table (priority 1)
- Chops Lobster Bar (priority 1)
- Little Sparrow (priority 1)
- Taqueria Del Sol (priority 2)
- Barcelona Wine Bar (priority 2)
- Marcel (priority 3)

**Experience (1):**
- Château Élan Winery (priority 2)

## How

Run the provided SQL INSERT as a database migration — single statement, 13 rows. No schema changes needed. Then verify with:

```sql
SELECT name, category, priority FROM voyance_picks WHERE destination = 'Atlanta' ORDER BY priority, name;
```

Data-only operation. No code changes required.

