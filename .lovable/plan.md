

# Voyance Picks Batch 4: Philadelphia + Dallas

## What

Insert 4 founder-curated picks:

| Destination | Name | Category | Priority |
|---|---|---|---|
| Philadelphia | Pat's King of Steaks | dining | 1 |
| Philadelphia | Geno's Steaks | dining | 1 |
| Philadelphia | Reading Terminal Market | experience | 1 |
| Dallas | WorldSprings | experience | 2 |

## How

Run the provided SQL INSERT as a single database migration — 4 rows, no schema changes. Then verify with:

```sql
SELECT destination, name, category FROM voyance_picks WHERE destination IN ('Philadelphia', 'Dallas') ORDER BY destination;
```

Data-only operation. No code changes required.

