

## Fix: Zero Out Phantom Pricing on Free Public Venues

### Problem
The AI assigns ~€23/pp costs to obviously free venues like public plazas, parks, viewpoints, and neighborhood walks. There is no existing phantom pricing logic in `sanitization.ts` — this is a new addition.

### Change

**File: `supabase/functions/generate-itinerary/sanitization.ts`** — inside `sanitizeGeneratedDay`, within the existing `day.activities.map()` loop (around line 274, just before `return act;`), add a two-tier free venue detection block.

**Important field mapping**: The activity cost field is `act.cost` (an object `{ amount, currency }`), not `cost_per_person` as the prompt suggests. The logic will check `act.cost?.amount`.

```typescript
// Zero out pricing for obviously free activity types
// Tier 1 (high confidence): always free — parks, plazas, churches, viewpoints, districts
// Tier 2 (lower confidence): free only if description says "free" or price is in phantom €20-25 range
const tier1FreePatterns = /\b(?:park|garden|jardim|viewpoint|miradouro|plaza|praça|praca|square|piazza|platz|church|igreja|basilica|cathedral|dom|riverside|waterfront|riverbank|stroll|walk|district|neighborhood|neighbourhood|bairro|quarter|old\s+town)\b/i;
const tier2FreePatterns = /\b(?:bridge|fountain|monument|memorial|statue|arch|gate|market|promenade|boardwalk|trail|path|pier|dock|wharf|embankment)\b/i;

if (act.cost && typeof act.cost === 'object' && act.cost.amount > 0 && act.cost.amount <= 30) {
  const titleAndVenue = (act.title || '') + ' ' + (act.venue_name || '') + ' ' + (act.location?.name || '');
  const description = act.description || '';

  if (tier1FreePatterns.test(titleAndVenue)) {
    console.log(`[sanitize] Zeroed phantom cost $${act.cost.amount} on free venue: ${act.title}`);
    act.cost = { amount: 0, currency: act.cost.currency || 'USD' };
  } else if (tier2FreePatterns.test(titleAndVenue)) {
    const descSaysFree = /\bfree\b/i.test(description);
    const isPhantomPrice = act.cost.amount >= 20 && act.cost.amount <= 25;
    if (descSaysFree || isPhantomPrice) {
      console.log(`[sanitize] Zeroed tier2 phantom cost $${act.cost.amount} on: ${act.title}`);
      act.cost = { amount: 0, currency: act.cost.currency || 'USD' };
    }
  }
}
```

The regex patterns will be defined as constants outside the function for clarity (or inline — single location either way).

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — add phantom pricing zero-out logic inside the activity sanitization loop

