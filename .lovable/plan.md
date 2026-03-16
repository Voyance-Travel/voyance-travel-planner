

# Voyance Picks Batch 5: London

## What

Insert 12 founder-curated London picks into the `voyance_picks` table:

| Name | Category | Priority |
|---|---|---|
| British Museum | activity | 1 |
| Gordon's Wine Bar | dining | 1 |
| Noble Rot | dining | 1 |
| Flat Iron | dining | 1 |
| Yauatcha | dining | 1 |
| Ronnie Scott's Jazz Club | nightlife | 1 |
| Borough Market | experience | 1 |
| Heathrow Express | experience | 2 |
| Trafalgar Square | activity | 2 |
| Fatt Pundit | dining | 2 |
| Sushi Kyu | dining | 2 |
| Ladurée | dining | 3 |

## How

Single SQL INSERT migration — 12 rows, data only, no schema changes. Verify with:

```sql
SELECT name, category, priority FROM voyance_picks WHERE destination = 'London' ORDER BY priority, name;
```

