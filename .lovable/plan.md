

# Voyance Picks Batch 6: Paris

## What

Insert 7 founder-curated Paris picks:

| Name | Category | Priority |
|---|---|---|
| Louvre Museum | activity | 1 |
| Sacré-Cœur | activity | 1 |
| Seine River | experience | 1 |
| Angelina | dining | 1 |
| Le Relais de l'Entrecôte | dining | 1 |
| Petit Bon | dining | 2 |
| Sacré Fleur | dining | 2 |

## How

Single SQL INSERT migration — 7 rows, data only, no schema changes. Verify with:

```sql
SELECT name, category, priority FROM voyance_picks WHERE destination = 'Paris' ORDER BY priority, name;
```

