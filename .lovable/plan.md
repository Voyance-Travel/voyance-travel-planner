

## Add Known Casual Restaurants to Price Cap List

### Change

**File: `supabase/functions/generate-itinerary/sanitization.ts`** — Append new entries to the `KNOWN_CASUAL_VENUES` map (line 675, before the closing `};`):

```typescript
  // Montmartre casual restaurants
  'le moulin de la galette': 50,
  'le consulat': 40,
  'la maison rose': 45,

  // Other commonly overpriced Paris venues
  'le petit journal': 50,
  'bouillon chartier': 30,
  'bouillon pigalle': 30,
  'bouillon julien': 35,
  "le relais de l'entrecôte": 55,
  'le relais de l\'entrecôte': 55,
  'pink mamma': 40,
  'breizh café': 35,
  'breizh cafe': 35,
```

Note: `le relais de l'entrecôte` and `breizh café` each get an accent-stripped duplicate for matching robustness, following the existing pattern (e.g. `café de flore` / `cafe de flore`).

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Add 13 entries to `KNOWN_CASUAL_VENUES` map |

### Deployment
Redeploy `generate-itinerary` edge function.

