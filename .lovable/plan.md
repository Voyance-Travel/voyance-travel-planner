

## Fix Placeholder Meals and Restore Michelin Dining to Luxury Trips

### Analysis

The validation layer (`validate-day.ts`) already catches generic titles like "Lunch at a bistro" and locations like "the destination", and the repair layer (`repair-day.ts`) already has Paris/Berlin/Rome/London fallback restaurants. However, two gaps remain:

1. **Placeholder detection gaps**: The validator doesn't catch when `location.name` is just the city name (e.g., `"Paris"`) or when descriptions contain `"get a restaurant recommendation"`. These slip through validation, so repair never fires.

2. **No Michelin inclusion guidance**: The prompt tells the AI how to *price* Michelin restaurants but never tells it to *include* them. After pricing enforcement was added, the AI learned to avoid Michelin venues entirely rather than price them correctly.

### Changes

#### 1. Expand placeholder detection in `validate-day.ts` (~line 247)

In `checkGenericVenues`, expand `hasPlaceholderLocation` to also catch:
- Location name matching the destination city name (case-insensitive) — e.g., `"paris"`, `"rome"`, `"berlin"`
- Description containing `"get a restaurant recommendation"` or `"ask for recommendations"`

This requires passing the destination city into the validator. Add `destination?: string` to `ValidateDayInput` (it's already there from the demonym fix) and thread it into `checkGenericVenues`.

```typescript
// Add to hasPlaceholderLocation check:
const destLower = (destination || '').toLowerCase().trim();
const isCityNameOnly = destLower && locationName === destLower;
const hasPlaceholderDescription = description.includes('get a restaurant recommendation') || 
  description.includes('ask for recommendations');

const hasPlaceholderLocation = locationName === 'the destination' || locationName === '' ||
  isCityNameOnly || hasPlaceholderDescription ||
  /^(a |the )?(local |nearby )?(spot|place|restaurant|...)/i.test(locationName);
```

#### 2. Add Michelin inclusion guidance to prompt (`compile-prompt.ts` ~line 832)

After the existing Michelin pricing rules, add inclusion guidance that scales with trip length:

```
MICHELIN DINING INCLUSION (for cities with Michelin restaurants):
- Trips of 3+ days: include AT LEAST 1 Michelin-starred dinner
- Trips of 5+ days: include 2-3 Michelin-starred dinners
- It is BETTER to include a correctly-priced Michelin restaurant than to avoid all Michelin restaurants
- Do NOT remove Michelin restaurants to avoid pricing issues — price them correctly instead
- Michelin dinners add prestige and variety to a luxury itinerary
```

This block should be conditional — only injected when the trip is 3+ days. The `totalDays` variable is already available in scope.

#### 3. Add Michelin inclusion logging in `action-generate-trip-day.ts`

After the final guard loop where Michelin price floors are enforced, add a diagnostic log that checks whether any dinner activity matches a `KNOWN_FINE_DINING_STARS` key. If none match on a 3+ day trip, log a warning: `MICHELIN INCLUSION: No Michelin restaurants on a N-day trip`. This is observability only — no mutation.

### Files to edit

| File | Change |
|------|--------|
| `pipeline/validate-day.ts` | Expand `checkGenericVenues` to catch city-name-as-location and placeholder descriptions; thread `destination` param |
| `pipeline/compile-prompt.ts` | Add Michelin inclusion guidance block after pricing rules (conditional on 3+ day trips) |
| `action-generate-trip-day.ts` | Add post-guard Michelin inclusion diagnostic log |

