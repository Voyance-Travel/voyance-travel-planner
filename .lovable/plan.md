

# Voyance Picks Batch 7: Rome + Barcelona

## What
Insert 9 founder-curated picks:
- **Rome (4)**: Trevi Fountain, Colosseum, Tonnarello, The Pantheon Iconic Rome Hotel
- **Barcelona (5)**: La Boqueria, Sagrada Família, Piscina Municipal de Montjuïc, Bar Cañete, Dow Jones Bar

## How
Create a new SQL migration file with the provided INSERT statement (9 rows into `voyance_picks`). No schema changes needed — data only.

After migration runs, verify with:
```sql
SELECT destination, name, category FROM voyance_picks WHERE destination IN ('Rome', 'Barcelona') ORDER BY destination, priority;
```

