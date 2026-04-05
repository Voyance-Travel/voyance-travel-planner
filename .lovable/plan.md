

## Fix Phantom €23 Pricing — Add Bookstores/Libraries

### Problem
Bookstores and libraries (e.g., Livraria Bertrand) are free-to-enter cultural venues but receive phantom ~€23 pricing because the Tier 1 free patterns don't include them.

### Change

**`supabase/functions/generate-itinerary/sanitization.ts`** — Line 294

Extend the `tier1FreePatterns` regex to include bookstore/library terms:

```typescript
const tier1FreePatterns = /\b(?:park|garden|jardim|viewpoint|miradouro|plaza|praça|praca|square|piazza|platz|church|igreja|basilica|cathedral|dom|riverside|waterfront|riverbank|stroll|walk|district|neighborhood|neighbourhood|bairro|quarter|old\s+town|bookstore|bookshop|livraria|library|biblioteca)\b/i;
```

Single line change — adds `|bookstore|bookshop|livraria|library|biblioteca` to the end of the existing pattern.

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` (line 294 only)

